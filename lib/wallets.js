// WAX wallets linked to players' Telegram accounts, shared by every bot: a player's Telegram user id
// is the same in all of them, so a wallet linked in one bot is known to the others. Also the web
// sign-in routes and the /wallets screen.
const crypto = require('crypto')
const axios = require('axios')
const db = require('../db')

const SIGNIN_TOKEN_TTL_SECONDS = 24 * 60 * 60

// per bot: what the sign-in page shows and what the bot says once a wallet is linked
const linkHandlers = {}

// Each sign-in button gets its own one-time link, so the page never has to trust a chat id from the URL.
// bot is the bot to carry on in after sign-in; resume is what the player was doing there (e.g. a door).
function createSigninLink(chatId, name, bot, resume = null) {
  const token = crypto.randomBytes(24).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  db.prepare('DELETE FROM signin_tokens WHERE expires_at < ?').run(now)
  db.prepare('INSERT INTO signin_tokens (token, chat_id, name, expires_at, bot, door) VALUES (?, ?, ?, ?, ?, ?)')
    .run(token, String(chatId), name, now + SIGNIN_TOKEN_TTL_SECONDS, bot, resume)
  return `${process.env.PUBLIC_URL}/?t=${token}`
}

// adds the wallet to the player's list and makes it their active wallet
function linkWallet(chatId, address, name) {
  db.prepare('INSERT OR IGNORE INTO wallets (chat_id, address, added_at) VALUES (?, ?, ?)')
    .run(String(chatId), address, Math.floor(Date.now() / 1000))
  db.prepare(`
    INSERT INTO users (chat_id, address, name) VALUES (?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET address = excluded.address, name = excluded.name
  `).run(String(chatId), address, name)
}

// the wallet used for inventory checks, or null if the player hasn't linked one
function getActiveWallet(chatId) {
  const user = db.prepare('SELECT address FROM users WHERE chat_id = ?').get(String(chatId))
  return user ? user.address : null
}

function getWallets(chatId) {
  return db.prepare('SELECT address FROM wallets WHERE chat_id = ? ORDER BY added_at').all(String(chatId)).map((row) => row.address)
}

// how many of each niftywizards template the account holds, e.g. { 1627: 1, 85: 0 }
async function countTemplates(address, templateIds) {
  const response = await axios.get(`https://wax.api.atomicassets.io/atomicassets/v1/accounts/${address}`, {
    params: { collection_whitelist: 'niftywizards' },
  })
  const counts = {}
  for (const id of templateIds) {
    const template = response.data.data.templates.find((t) => parseInt(t.template_id) === id)
    counts[id] = template ? parseInt(template.assets) : 0
  }
  return counts
}

// handlers.page(address) -> extra fields for the sign-in page's response (optional)
// handlers.telegram(session, address) -> carry on in the bot once the wallet is linked
function onLinked(botName, handlers) {
  linkHandlers[botName] = handlers
}

function registerSigninRoutes(expressApp) {
  // the wax wallet sign-in page the bots' sign-in buttons link to
  expressApp.get('/', (req, res) => {
    res.render('index')
  })

  // the sign-in page posts the wax address it logged in with, plus the one-time token
  expressApp.post('/api/link', async (req, res) => {
    if (typeof req.body.address !== 'string' || !/^[a-z1-5.]{1,12}$/.test(req.body.address)) {
      return res.status(400).send('Invalid wax address')
    }
    const session = db.prepare('SELECT * FROM signin_tokens WHERE token = ?').get(String(req.body.token))
    if (!session || session.expires_at < Math.floor(Date.now() / 1000)) {
      return res.status(401).send('This sign-in link has expired. Please get a new one from the bot.')
    }
    db.prepare('DELETE FROM signin_tokens WHERE token = ?').run(session.token)
    linkWallet(session.chat_id, req.body.address, session.name)

    // links made before the bot column existed all came from the Keyroom bot
    const handlers = linkHandlers[session.bot || 'keyroom'] || {}
    let page = {}
    if (handlers.page) {
      try {
        page = await handlers.page(req.body.address)
      } catch (error) {
        console.log(error)
      }
    }
    res.json({ ok: true, ...page })

    if (handlers.telegram) {
      try {
        await handlers.telegram(session, req.body.address)
      } catch (error) {
        console.log(error)
      }
    }
  })
}

// /wallets for one bot: every linked wallet, labelled by describe(address) (that bot's items),
// tap one to make it active or ✖ to unlink it.
function registerWalletCommands(bot, { botName, describe }) {
  async function walletsMessage(chatId, name) {
    const wallets = getWallets(chatId)
    const active = getActiveWallet(chatId)
    const addRow = [{ text: '➕ Add a wallet', url: createSigninLink(chatId, name, botName) }]
    if (wallets.length === 0) {
      return {
        text: `You haven't linked a WAX wallet yet.`,
        extra: { reply_markup: { inline_keyboard: [addRow] } },
      }
    }
    const labels = await Promise.all(wallets.map((address) => describe(address).catch(() => '?')))
    const rows = wallets.map((address, i) => [
      { text: `${address === active ? '✅ ' : ''}${address} · ${labels[i]}`, callback_data: `usewallet:${address}` },
      { text: '✖', callback_data: `rmwallet:${address}` },
    ])
    rows.push(addRow)
    return {
      text: `Your WAX wallets. The ✅ wallet is used when the story checks your pockets. Tap a wallet to use it instead.\n\nAdding a Cloud Wallet account that's different from the one you're logged into? Log out at mycloudwallet.com first.`,
      extra: { reply_markup: { inline_keyboard: rows } },
    }
  }

  async function showWallets(ctx) {
    const { text, extra } = await walletsMessage(ctx.chat.id, ctx.from.username)
    return ctx.telegram.sendMessage(ctx.chat.id, text, extra)
  }

  // redraws the /wallets message in place after a change
  async function refreshWallets(ctx) {
    const { text, extra } = await walletsMessage(ctx.chat.id, ctx.from.username)
    return ctx.editMessageText(text, extra).catch((error) => console.log(error))
  }

  bot.command('wallets', showWallets)
  bot.action('wallets', (ctx) => {
    ctx.answerCbQuery()
    return showWallets(ctx)
  })

  bot.action(/^usewallet:(.+)$/, (ctx) => {
    const address = ctx.match[1]
    if (!getWallets(ctx.chat.id).includes(address)) {
      return ctx.answerCbQuery('That wallet is no longer linked.')
    }
    db.prepare('UPDATE users SET address = ? WHERE chat_id = ?').run(address, String(ctx.chat.id))
    ctx.answerCbQuery(`Now using ${address}`)
    return refreshWallets(ctx)
  })

  bot.action(/^rmwallet:(.+)$/, (ctx) => {
    const chatId = String(ctx.chat.id)
    const address = ctx.match[1]
    db.prepare('DELETE FROM wallets WHERE chat_id = ? AND address = ?').run(chatId, address)
    if (getActiveWallet(chatId) === address) {
      // fall back to the most recently added wallet that's left, if any
      const next = getWallets(chatId).pop()
      if (next) {
        db.prepare('UPDATE users SET address = ? WHERE chat_id = ?').run(next, chatId)
      } else {
        db.prepare('DELETE FROM users WHERE chat_id = ?').run(chatId)
      }
    }
    ctx.answerCbQuery(`Removed ${address}`)
    return refreshWallets(ctx)
  })
}

module.exports = {
  createSigninLink, linkWallet, getActiveWallet, getWallets, countTemplates,
  onLinked, registerSigninRoutes, registerWalletCommands,
}
