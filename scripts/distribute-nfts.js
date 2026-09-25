#!/usr/bin/env node
// One-time NFT distribution: sends NFTs from one WAX account to several others, following a plan file.
//
// usage: node scripts/distribute-nfts.js <plan.csv> [options]
//   --from=<account>       sender (default DISTRIBUTOR_ACCOUNT from .env)
//   --pick=highest|lowest  which mint numbers to send first for counts and "rest" (default highest,
//                          so the sender keeps its low mints)
//   --keep=1,69            mint numbers that are never sent
//   --keep-below=1000      never send mint numbers below this (keeps the low mints)
//   --batch=100            NFTs per transaction
//   --send                 sign with DISTRIBUTOR_PRIVATE_KEY and send (asks to confirm; --yes skips that)
//   --cloud                for a WAX Cloud Wallet sender: opens a page on this PC where you log in and
//                          approve each transaction in MyCloudWallet
//
// Plan file, one line per recipient (see scripts/distribution.example.csv):
//   recipient, template_id, amount, memo (optional)
// where amount is a count (2), specific mint numbers (#12 #40), "rest" for everything left over, or
// "share" to split what's left evenly between every "share" line, dealt out in mint order like cards
// so each recipient gets a mix of low and high mints.
//
// Without --send or --cloud it is a dry run: it checks the plan against the sender's wallet, prints
// who gets what, writes the full list of asset ids and mint numbers next to the plan, and sends nothing.
//
// --send needs, in .env (never commit it):
//   DISTRIBUTOR_ACCOUNT=youraccount
//   DISTRIBUTOR_PRIVATE_KEY=<private key for that account's active permission>
//   DISTRIBUTOR_PERMISSION=active   (optional)
//   WAX_RPC_URL=https://wax.greymass.com   (optional)
const fs = require('fs')
const http = require('http')
const path = require('path')
const readline = require('readline')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const { Api, JsonRpc } = require('eosjs')
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
const { PrivateKey } = require('eosjs/dist/eosjs-key-conversions')

const ATOMIC_API = 'https://wax.api.atomicassets.io'
const RPC_URL = process.env.WAX_RPC_URL || 'https://wax.greymass.com'
const ACCOUNT_NAME = /^[a-z1-5.]{1,12}$/
const CLOUD_PORT = 8088

function parseArgs(argv) {
  const args = { plan: null, from: process.env.DISTRIBUTOR_ACCOUNT, pick: 'highest', keep: [], keepBelow: 0, batch: 100, send: false, cloud: false, yes: false }
  for (const arg of argv) {
    if (arg === '--send') args.send = true
    else if (arg === '--cloud') args.cloud = true
    else if (arg === '--yes') args.yes = true
    else if (arg.startsWith('--from=')) args.from = arg.slice(7)
    else if (arg.startsWith('--pick=')) args.pick = arg.slice(7)
    else if (arg.startsWith('--keep=')) args.keep = arg.slice(7).split(',').map((m) => parseInt(m.replace('#', '')))
    else if (arg.startsWith('--keep-below=')) args.keepBelow = parseInt(arg.slice(13).replace('#', ''))
    else if (arg.startsWith('--batch=')) args.batch = parseInt(arg.slice(8))
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`)
    else args.plan = arg
  }
  if (!args.plan) throw new Error('usage: node scripts/distribute-nfts.js <plan.csv> [--from=] [--pick=] [--keep=] [--keep-below=] [--batch=] [--send | --cloud] [--yes]')
  if (!args.from) throw new Error('no sender: set DISTRIBUTOR_ACCOUNT in .env or pass --from=<account>')
  if (!['highest', 'lowest'].includes(args.pick)) throw new Error('--pick must be highest or lowest')
  if (args.keep.some(Number.isNaN)) throw new Error('--keep takes mint numbers, e.g. --keep=1,69')
  if (Number.isNaN(args.keepBelow) || args.keepBelow < 0) throw new Error('--keep-below takes a mint number, e.g. --keep-below=1000')
  if (!(args.batch > 0)) throw new Error('--batch must be a positive number')
  if (args.send && args.cloud) throw new Error('use either --send (private key) or --cloud (Cloud Wallet), not both')
  return args
}

// "recipient, template_id, 2 | #12 #40 | rest | share, memo" -> { recipient, templateId, count, mints, rest, share, memo }
function parsePlan(text) {
  const rows = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    const [recipient, template, amount, ...memo] = line.split(',').map((part) => part.trim())
    const where = `plan line ${i + 1}`
    if (!ACCOUNT_NAME.test(recipient || '')) throw new Error(`${where}: "${recipient}" is not a valid WAX account name`)
    if (!/^\d+$/.test(template || '')) throw new Error(`${where}: template id "${template}" should be a number`)
    const row = { line: i + 1, recipient, templateId: parseInt(template), count: 0, mints: [], rest: false, share: false, memo: memo.join(',').trim() }
    if (/^\d+$/.test(amount || '')) {
      row.count = parseInt(amount)
    } else if (/^(#\d+\s*)+$/.test(amount || '')) {
      row.mints = amount.match(/\d+/g).map(Number)
    } else if ((amount || '').toLowerCase() === 'rest') {
      row.rest = true
    } else if ((amount || '').toLowerCase() === 'share') {
      row.share = true
    } else {
      throw new Error(`${where}: "${amount}" should be a count (2), mint numbers (#12 #40), rest or share`)
    }
    if (!row.rest && !row.share && row.count === 0 && row.mints.length === 0) throw new Error(`${where}: nothing to send`)
    rows.push(row)
  })
  if (rows.length === 0) throw new Error('the plan file has no lines to send')
  const restTemplates = rows.filter((r) => r.rest).map((r) => r.templateId)
  const doubled = restTemplates.find((id, i) => restTemplates.indexOf(id) !== i)
  if (doubled !== undefined) throw new Error(`only one line per template can take "rest" (template ${doubled})`)
  const mixed = restTemplates.find((id) => rows.some((r) => r.share && r.templateId === id))
  if (mixed !== undefined) throw new Error(`template ${mixed} has both "rest" and "share" lines; use one or the other`)
  return rows
}

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  const body = await res.json()
  if (body.success === false) throw new Error(`${url} -> ${body.message}`)
  return body.data
}

// every NFT of the template the account holds: { assetId, mint, name }
async function fetchHoldings(owner, templateId) {
  const assets = []
  for (let page = 1; ; page++) {
    const data = await getJson(`${ATOMIC_API}/atomicassets/v1/assets?owner=${owner}&template_id=${templateId}&limit=1000&page=${page}&order=asc&sort=asset_id`)
    for (const a of data) {
      assets.push({
        assetId: a.asset_id,
        mint: parseInt(a.template_mint),
        name: (a.data && a.data.name) || (a.template && a.template.immutable_data && a.template.immutable_data.name) || `template ${templateId}`,
      })
    }
    if (data.length < 1000) return assets
  }
}

// asset ids the account has listed for sale on AtomicHub; sending those would break the listing
async function fetchListedAssetIds(seller) {
  const ids = new Set()
  for (let page = 1; ; page++) {
    const data = await getJson(`${ATOMIC_API}/atomicmarket/v2/sales?seller=${seller}&state=1&limit=100&page=${page}`)
    for (const sale of data) for (const a of sale.assets) ids.add(a.asset_id)
    if (data.length < 100) return ids
  }
}

// Picks the NFTs for each plan row from the sender's holdings, never touching listed NFTs or kept
// mints. Explicit mint numbers first, then counts, then "rest" takes whatever is left.
// keep is a list of mint numbers or a (mint) => boolean
function allocate(rows, holdingsByTemplate, listed, pick, keep = []) {
  const isKept = typeof keep === 'function' ? keep : (mint) => keep.includes(mint)
  const available = {}
  for (const [templateId, assets] of Object.entries(holdingsByTemplate)) {
    available[templateId] = assets
      .filter((a) => !listed.has(a.assetId) && !isKept(a.mint))
      .sort((a, b) => (pick === 'highest' ? b.mint - a.mint : a.mint - b.mint))
  }
  const problems = []
  const take = (templateId, predicate) => {
    const pool = available[templateId]
    const index = pool.findIndex(predicate)
    return index < 0 ? null : pool.splice(index, 1)[0]
  }
  const allocations = rows.map((row) => ({ ...row, assets: [] }))
  for (const row of allocations) {
    for (const mint of row.mints) {
      const asset = isKept(mint) ? null : take(row.templateId, (a) => a.mint === mint)
      if (asset) row.assets.push(asset)
      else problems.push(`line ${row.line}: mint #${mint} of template ${row.templateId} isn't available (not in the sender's wallet, listed for sale, kept, or already used above)`)
    }
  }
  for (const row of allocations) {
    for (let i = 0; i < row.count; i++) {
      const asset = take(row.templateId, () => true)
      if (!asset) {
        problems.push(`line ${row.line}: not enough of template ${row.templateId} left for ${row.recipient} (wanted ${row.count}, got ${row.assets.length})`)
        break
      }
      row.assets.push(asset)
    }
  }
  for (const row of allocations.filter((r) => r.rest)) {
    row.assets.push(...available[row.templateId].splice(0))
    if (row.assets.length === 0) problems.push(`line ${row.line}: nothing of template ${row.templateId} is left for ${row.recipient} ("rest")`)
  }
  // deal what's left round-robin in mint order, so every share gets low and high mints alike
  for (const templateId of new Set(allocations.filter((r) => r.share).map((r) => r.templateId))) {
    const sharers = allocations.filter((r) => r.share && r.templateId === templateId)
    const pool = available[templateId].splice(0).sort((a, b) => a.mint - b.mint)
    pool.forEach((asset, i) => sharers[i % sharers.length].assets.push(asset))
    for (const row of sharers) {
      if (row.assets.length === 0) problems.push(`line ${row.line}: nothing of template ${row.templateId} is left for ${row.recipient} ("share")`)
    }
  }
  return { allocations, problems }
}

// transactions of at most batchSize NFTs each, one atomicassets::transfer per recipient and memo in each
function buildTransactions(from, permission, allocations, batchSize) {
  const grouped = new Map()
  for (const row of allocations) {
    const key = `${row.recipient}\n${row.memo}`
    if (!grouped.has(key)) grouped.set(key, { to: row.recipient, memo: row.memo, assetIds: [] })
    grouped.get(key).assetIds.push(...row.assets.map((a) => a.assetId))
  }
  const transactions = []
  let current = []
  let size = 0
  for (const g of grouped.values()) {
    let ids = g.assetIds
    while (ids.length) {
      const room = batchSize - size
      const part = ids.slice(0, room)
      ids = ids.slice(room)
      current.push({
        account: 'atomicassets',
        name: 'transfer',
        authorization: [{ actor: from, permission }],
        data: { from, to: g.to, asset_ids: part, memo: g.memo },
      })
      size += part.length
      if (size === batchSize) {
        transactions.push(current)
        current = []
        size = 0
      }
    }
  }
  if (current.length) transactions.push(current)
  return transactions
}

// "#5, #69, #169–#173, …" for printing long mint lists
function mintRanges(mints, limit = 12) {
  const sorted = [...mints].sort((a, b) => a - b)
  const ranges = []
  for (const m of sorted) {
    const last = ranges[ranges.length - 1]
    if (last && m === last[1] + 1) last[1] = m
    else ranges.push([m, m])
  }
  const text = ranges.slice(0, limit).map(([a, b]) => (a === b ? `#${a}` : `#${a}–#${b}`)).join(', ')
  return ranges.length > limit ? `${text}, … (${ranges.length - limit} more ranges)` : text
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()) }))
}

// the key must belong to the account's permission, or every transaction would just be rejected
async function checkKey(rpc, account, permission, privateKey) {
  const publicKey = PrivateKey.fromString(privateKey).getPublicKey()
  const formats = [publicKey.toString(), publicKey.toLegacyString()]
  const info = await rpc.get_account(account)
  const perm = info.permissions.find((p) => p.perm_name === permission)
  if (!perm) throw new Error(`${account} has no "${permission}" permission`)
  if (!perm.required_auth.keys.some((k) => formats.includes(k.key))) {
    throw new Error(`DISTRIBUTOR_PRIVATE_KEY is not a key for ${account}@${permission}`)
  }
}

function describeTransaction(transaction) {
  return transaction.map((a) => `${a.data.to} (${a.data.asset_ids.length})`).join(', ')
}

async function sendWithKey(rpc, args, permission, transactions, total) {
  const privateKey = process.env.DISTRIBUTOR_PRIVATE_KEY
  if (!privateKey) throw new Error('set DISTRIBUTOR_PRIVATE_KEY in .env to send')
  if (process.env.DISTRIBUTOR_ACCOUNT && process.env.DISTRIBUTOR_ACCOUNT !== args.from) {
    throw new Error(`--from=${args.from} doesn't match DISTRIBUTOR_ACCOUNT=${process.env.DISTRIBUTOR_ACCOUNT}`)
  }
  await checkKey(rpc, args.from, permission, privateKey)

  if (!args.yes) {
    const answer = await ask(`\nSend ${total} NFTs from ${args.from}? This can't be undone. Type "send" to continue: `)
    if (answer !== 'send') {
      console.log('Cancelled, nothing was sent.')
      return
    }
  }

  const api = new Api({
    rpc,
    signatureProvider: new JsSignatureProvider([privateKey]),
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder(),
  })
  const log = { from: args.from, startedAt: new Date().toISOString(), transactions: [] }
  const logPath = path.join(path.dirname(path.resolve(args.plan)), `distribution-log-${Date.now()}.json`)
  try {
    for (const [i, transaction] of transactions.entries()) {
      const result = await api.transact({ actions: transaction }, { blocksBehind: 3, expireSeconds: 120 })
      console.log(`  ✅ transaction ${i + 1}/${transactions.length}: ${describeTransaction(transaction)}\n     https://waxblock.io/transaction/${result.transaction_id}`)
      log.transactions.push({ id: result.transaction_id, transfers: transaction.map((a) => a.data) })
    }
    console.log('\nDone.')
  } catch (error) {
    // stop at the first failure so it's clear exactly what was and wasn't sent
    const message = (error.json && JSON.stringify(error.json.error && error.json.error.details)) || error.message
    console.log(`\n❌ transaction ${log.transactions.length + 1} failed: ${message}`)
    console.log(`Sent before the failure: ${log.transactions.length} transaction(s). Nothing after that was sent.`)
    log.error = message
    process.exitCode = 1
  } finally {
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2))
    console.log(`Log: ${logPath}`)
  }
}

// Serves the approval page on this PC. The batches and which ones are done live in a state file next
// to the plan, so closing the page or re-running the script carries on without sending anything twice.
function serveCloudApproval(statePath) {
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
  const save = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2))
  const files = {
    '/': [path.join(__dirname, 'cloud-approve.html'), 'text/html; charset=utf-8'],
    '/waxjs.bundle.js': [path.join(__dirname, '..', 'static', 'js', 'waxjs.bundle.js'), 'application/javascript'],
  }
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && files[req.url]) {
      const [file, type] = files[req.url]
      res.writeHead(200, { 'Content-Type': type })
      return res.end(fs.readFileSync(file))
    }
    if (req.method === 'GET' && req.url === '/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify(state))
    }
    if (req.method === 'POST' && req.url === '/result') {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', () => {
        const { index, transactionId } = JSON.parse(body)
        const tx = state.transactions[index]
        if (tx && !tx.transactionId && typeof transactionId === 'string') {
          tx.transactionId = transactionId
          tx.sentAt = new Date().toISOString()
          save()
          const done = state.transactions.filter((t) => t.transactionId).length
          console.log(`  ✅ ${done}/${state.transactions.length}: ${describeTransaction(tx.actions)}  https://waxblock.io/transaction/${transactionId}`)
          if (done === state.transactions.length) console.log(`\nAll ${done} transactions sent. Record: ${statePath}\nPress Ctrl+C to stop.`)
        }
        res.writeHead(204)
        res.end()
      })
      return
    }
    res.writeHead(404)
    res.end()
  })
  // localhost only: the page is for you, not the network
  server.listen(CLOUD_PORT, '127.0.0.1', () => {
    console.log(`\nOpen http://localhost:${CLOUD_PORT} in your browser, log in as ${state.from} and approve each batch.`)
    console.log('Leave this running until you are done; press Ctrl+C to stop.')
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const permission = process.env.DISTRIBUTOR_PERMISSION || 'active'
  const statePath = path.resolve(args.plan) + '.cloud-state.json'

  // a Cloud Wallet run already under way: carry on with exactly the same batches
  if (args.cloud && fs.existsSync(statePath)) {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    const done = state.transactions.filter((t) => t.transactionId).length
    console.log(`Resuming the Cloud Wallet run in ${statePath}: ${done}/${state.transactions.length} transactions already sent.`)
    console.log('(Delete that file to plan from scratch.)')
    return serveCloudApproval(statePath)
  }

  const rpc = new JsonRpc(RPC_URL, { fetch })
  const rows = parsePlan(fs.readFileSync(args.plan, 'utf8'))

  // every recipient must exist, or the whole transaction fails
  const recipients = [...new Set(rows.map((r) => r.recipient))]
  for (const name of recipients) {
    if (name === args.from) throw new Error(`${name} is the sender`)
    await rpc.get_account(name).catch(() => { throw new Error(`recipient ${name} doesn't exist on WAX`) })
  }

  const templateIds = [...new Set(rows.map((r) => r.templateId))]
  const holdingsByTemplate = {}
  for (const id of templateIds) holdingsByTemplate[id] = await fetchHoldings(args.from, id)
  const listed = await fetchListedAssetIds(args.from)
  const isKept = (mint) => args.keep.includes(mint) || mint < args.keepBelow
  const { allocations, problems } = allocate(rows, holdingsByTemplate, listed, args.pick, isKept)

  const order = rows.every((r) => r.share || r.mints.length) ? 'shares dealt in mint order' : `${args.pick} mint numbers first`
  const keeping = [
    ...args.keep.map((m) => `#${m}`),
    ...(args.keepBelow > 0 ? [`mints below #${args.keepBelow}`] : []),
  ]
  console.log(`\nFrom ${args.from} (${order}${keeping.length ? `, never sending ${keeping.join(', ')}` : ''}):\n`)
  for (const row of allocations) {
    const name = row.assets[0] ? row.assets[0].name : `template ${row.templateId}`
    const mints = row.assets.length ? mintRanges(row.assets.map((a) => a.mint)) : '(none)'
    console.log(`  ${row.recipient.padEnd(12)} ${String(row.assets.length).padStart(5)} × ${name} [${row.templateId}]  ${mints}${row.memo ? `  memo: "${row.memo}"` : ''}`)
  }
  for (const id of templateIds) {
    const held = holdingsByTemplate[id]
    const listedHere = held.filter((a) => listed.has(a.assetId)).length
    const keptHere = held.filter((a) => isKept(a.mint)).map((a) => `#${a.mint}`)
    const left = held.length - allocations.filter((r) => r.templateId === id).reduce((n, r) => n + r.assets.length, 0)
    console.log(`\n  template ${id}: sender holds ${held.length}${listedHere ? `, ${listedHere} listed for sale (not sent)` : ''}${keptHere.length ? `, keeps ${keptHere.join(' ')}` : ''}; ${left} stay with the sender`)
  }
  if (problems.length) {
    console.log('\nCan\'t send this plan:')
    for (const p of problems) console.log(`  - ${p}`)
    process.exitCode = 1
    return
  }

  const transactions = buildTransactions(args.from, permission, allocations, args.batch)
  const total = transactions.reduce((n, t) => n + t.reduce((m, a) => m + a.data.asset_ids.length, 0), 0)
  console.log(`\n${total} NFTs in ${transactions.length} transaction(s) of up to ${args.batch}.`)

  const previewPath = path.join(path.dirname(path.resolve(args.plan)), `distribution-preview-${Date.now()}.json`)
  fs.writeFileSync(previewPath, JSON.stringify(allocations.map((r) => ({
    line: r.line, recipient: r.recipient, templateId: r.templateId, memo: r.memo,
    assets: r.assets.map((a) => ({ assetId: a.assetId, mint: a.mint })),
  })), null, 2))
  console.log(`Full list of asset ids and mint numbers: ${previewPath}`)

  if (args.cloud) {
    fs.writeFileSync(statePath, JSON.stringify({
      from: args.from, total, createdAt: new Date().toISOString(),
      transactions: transactions.map((actions) => ({ actions, transactionId: null })),
    }, null, 2))
    return serveCloudApproval(statePath)
  }
  if (!args.send) {
    console.log('\nDry run: nothing was sent. Add --send (private key) or --cloud (Cloud Wallet) to send it.')
    return
  }
  await sendWithKey(rpc, args, permission, transactions, total)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`)
    process.exitCode = 1
  })
}

module.exports = { parsePlan, allocate, buildTransactions, mintRanges }
