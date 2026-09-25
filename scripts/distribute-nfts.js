#!/usr/bin/env node
// One-time NFT distribution: sends NFTs from one WAX account to several others, following a plan file.
//
// usage: node scripts/distribute-nfts.js <plan.csv> [--from=<account>] [--pick=highest|lowest] [--send] [--yes]
//
// Plan file, one line per recipient (see scripts/distribution.example.csv):
//   recipient, template_id, how many (e.g. 2) or which mint numbers (e.g. #12 #40), memo (optional)
//
// Without --send it is a dry run: it checks the plan against the sender's wallet and prints exactly
// which NFTs (asset id and mint number) would go where, and sends nothing.
//
// Sending needs, in .env (never commit it):
//   DISTRIBUTOR_ACCOUNT=youraccount
//   DISTRIBUTOR_PRIVATE_KEY=<private key for that account's active permission>
//   DISTRIBUTOR_PERMISSION=active   (optional)
//   WAX_RPC_URL=https://wax.greymass.com   (optional)
const fs = require('fs')
const path = require('path')
const readline = require('readline')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const { Api, JsonRpc } = require('eosjs')
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
const { PrivateKey } = require('eosjs/dist/eosjs-key-conversions')

const ATOMIC_API = 'https://wax.api.atomicassets.io'
const RPC_URL = process.env.WAX_RPC_URL || 'https://wax.greymass.com'
const ACTIONS_PER_TRANSACTION = 10
const ACCOUNT_NAME = /^[a-z1-5.]{1,12}$/

function parseArgs(argv) {
  const args = { plan: null, from: process.env.DISTRIBUTOR_ACCOUNT, pick: 'highest', send: false, yes: false }
  for (const arg of argv) {
    if (arg === '--send') args.send = true
    else if (arg === '--yes') args.yes = true
    else if (arg.startsWith('--from=')) args.from = arg.slice(7)
    else if (arg.startsWith('--pick=')) args.pick = arg.slice(7)
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`)
    else args.plan = arg
  }
  if (!args.plan) throw new Error('usage: node scripts/distribute-nfts.js <plan.csv> [--from=<account>] [--pick=highest|lowest] [--send] [--yes]')
  if (!args.from) throw new Error('no sender: set DISTRIBUTOR_ACCOUNT in .env or pass --from=<account>')
  if (!['highest', 'lowest'].includes(args.pick)) throw new Error('--pick must be highest or lowest')
  return args
}

// "recipient, template_id, 2 | #12 #40, memo" -> { recipient, templateId, count, mints, memo }
function parsePlan(text) {
  const rows = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    const [recipient, template, amount, ...memo] = line.split(',').map((part) => part.trim())
    const where = `plan line ${i + 1}`
    if (!ACCOUNT_NAME.test(recipient || '')) throw new Error(`${where}: "${recipient}" is not a valid WAX account name`)
    if (!/^\d+$/.test(template || '')) throw new Error(`${where}: template id "${template}" should be a number`)
    let count = 0
    let mints = []
    if (/^\d+$/.test(amount || '')) {
      count = parseInt(amount)
    } else if (/^(#\d+\s*)+$/.test(amount || '')) {
      mints = amount.match(/\d+/g).map(Number)
    } else {
      throw new Error(`${where}: "${amount}" should be a count (2) or mint numbers (#12 #40)`)
    }
    if (count === 0 && mints.length === 0) throw new Error(`${where}: nothing to send`)
    rows.push({ line: i + 1, recipient, templateId: parseInt(template), count, mints, memo: memo.join(',').trim() })
  })
  if (rows.length === 0) throw new Error('the plan file has no lines to send')
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
        collection: a.collection && a.collection.collection_name,
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

// Picks the NFTs for each plan row from the sender's holdings. Explicit mint numbers first, then
// counts from what's left, highest (or lowest) mint first.
function allocate(rows, holdingsByTemplate, listed, pick) {
  const available = {}
  for (const [templateId, assets] of Object.entries(holdingsByTemplate)) {
    available[templateId] = assets
      .filter((a) => !listed.has(a.assetId))
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
      const asset = take(row.templateId, (a) => a.mint === mint)
      if (asset) row.assets.push(asset)
      else problems.push(`line ${row.line}: mint #${mint} of template ${row.templateId} isn't in the sender's wallet (or is listed for sale or already used above)`)
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
  return { allocations, problems }
}

// one atomicassets::transfer per recipient and memo
function buildActions(from, permission, allocations) {
  const grouped = new Map()
  for (const row of allocations) {
    const key = `${row.recipient}\n${row.memo}`
    if (!grouped.has(key)) grouped.set(key, { to: row.recipient, memo: row.memo, assetIds: [] })
    grouped.get(key).assetIds.push(...row.assets.map((a) => a.assetId))
  }
  return [...grouped.values()].map((g) => ({
    account: 'atomicassets',
    name: 'transfer',
    authorization: [{ actor: from, permission }],
    data: { from, to: g.to, asset_ids: g.assetIds, memo: g.memo },
  }))
}

function chunk(list, size) {
  const chunks = []
  for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size))
  return chunks
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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const permission = process.env.DISTRIBUTOR_PERMISSION || 'active'
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
  const { allocations, problems } = allocate(rows, holdingsByTemplate, listed, args.pick)

  console.log(`\nFrom ${args.from} (${args.pick} mint numbers first):\n`)
  for (const row of allocations) {
    const name = row.assets[0] ? row.assets[0].name : `template ${row.templateId}`
    const list = row.assets.map((a) => `#${a.mint} (asset ${a.assetId})`).join(', ') || '(none)'
    console.log(`  ${row.recipient.padEnd(12)} ${String(row.assets.length).padStart(3)} × ${name} [${row.templateId}]  ${list}${row.memo ? `  memo: "${row.memo}"` : ''}`)
  }
  for (const id of templateIds) {
    const held = holdingsByTemplate[id].length
    const listedHere = holdingsByTemplate[id].filter((a) => listed.has(a.assetId)).length
    console.log(`\n  template ${id}: sender holds ${held}${listedHere ? ` (${listedHere} listed for sale, not used)` : ''}`)
  }
  if (problems.length) {
    console.log('\nCan\'t send this plan:')
    for (const p of problems) console.log(`  - ${p}`)
    process.exitCode = 1
    return
  }

  const actions = buildActions(args.from, permission, allocations)
  const total = actions.reduce((n, a) => n + a.data.asset_ids.length, 0)
  const batches = chunk(actions, ACTIONS_PER_TRANSACTION)
  console.log(`\n${total} NFTs to ${actions.length} transfer(s) in ${batches.length} transaction(s).`)

  if (!args.send) {
    console.log('\nDry run: nothing was sent. Add --send to send it.')
    return
  }

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
    for (const [i, batch] of batches.entries()) {
      const result = await api.transact({ actions: batch }, { blocksBehind: 3, expireSeconds: 120 })
      const recipientsInBatch = batch.map((a) => `${a.data.to} (${a.data.asset_ids.length})`).join(', ')
      console.log(`  ✅ transaction ${i + 1}/${batches.length}: ${recipientsInBatch}\n     https://waxblock.io/transaction/${result.transaction_id}`)
      log.transactions.push({ id: result.transaction_id, transfers: batch.map((a) => a.data) })
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

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`)
    process.exitCode = 1
  })
}

module.exports = { parsePlan, allocate, buildActions }
