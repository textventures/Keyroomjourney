// Erases the last 48 hours of a player's private chat with one or more of the bots.
// Bots can't clear a chat or list its history, but they can delete both sides of a private chat by
// message id for 48 hours. So this sends the player one silent message to learn the newest id, deletes
// it, then deletes every id below it (ids that aren't in the chat, or are too old, are skipped).
//
// The player is found by the username or name they signed in with (users and signin_tokens), or pass
// their chat id. Without --send it only shows who would be erased.
//
// Run: node scripts/erase-chat.js OnyxOuroboros --bots=goblin,keyroom --send
require('dotenv').config()
const db = require('../db')

const TOKENS = {
  keyroom: process.env.BOT_TOKEN,
  tavern: process.env.TAVERN_BOT_TOKEN,
  newhat: process.env.NEWHAT_BOT_TOKEN,
  goblin: process.env.GOBLIN_BOT_TOKEN,
  armsroom: process.env.ARMSROOM_BOT_TOKEN,
}

const args = process.argv.slice(2)
const option = (name, fallback) => (args.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1] || fallback
const who = args.find((a) => !a.startsWith('--'))
const bots = option('bots', 'goblin').split(',')
const range = Number(option('range', 5000))
const send = args.includes('--send')

if (!who) {
  console.log('Usage: node scripts/erase-chat.js <username|chat id> [--bots=goblin,keyroom] [--range=5000] [--send]')
  process.exit(1)
}

function findChatIds(who) {
  if (/^\d+$/.test(who)) return [who]
  const name = who.replace(/^@/, '').toLowerCase()
  const rows = [
    ...db.prepare('SELECT chat_id, name FROM users WHERE lower(name) = ?').all(name),
    ...db.prepare('SELECT chat_id, name FROM signin_tokens WHERE lower(name) = ?').all(name),
  ]
  return [...new Set(rows.map((r) => r.chat_id))]
}

async function call(token, method, params) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const json = await response.json()
  if (!json.ok) throw new Error(`${method}: ${json.description}`)
  return json.result
}

async function erase(botName, chatId) {
  const token = TOKENS[botName]
  if (!token) return console.log(`[${botName}] no token set, skipping`)
  let newest
  try {
    const probe = await call(token, 'sendMessage', { chat_id: chatId, text: '…', disable_notification: true })
    newest = probe.message_id
    await call(token, 'deleteMessage', { chat_id: chatId, message_id: newest })
  } catch (error) {
    return console.log(`[${botName}] can't reach chat ${chatId} (${error.message}), skipping`)
  }
  let requests = 0
  for (let top = newest - 1; top >= 1 && top > newest - range; top -= 100) {
    const ids = []
    for (let id = top; id > Math.max(0, top - 100, newest - range); id--) ids.push(id)
    await call(token, 'deleteMessages', { chat_id: chatId, message_ids: ids }).catch(() => {})
    requests++
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  console.log(`[${botName}] chat ${chatId}: swept message ids ${Math.max(1, newest - range + 1)}-${newest} (${requests} requests)`)
}

async function main() {
  const chatIds = findChatIds(who)
  if (chatIds.length === 0) {
    console.log(`No player named ${who} has signed in. Pass their chat id instead.`)
    process.exit(1)
  }
  if (chatIds.length > 1) {
    console.log(`More than one chat id matches ${who}: ${chatIds.join(', ')}. Pass the right chat id instead.`)
    process.exit(1)
  }
  console.log(`${who} is chat ${chatIds[0]}; bots: ${bots.join(', ')}`)
  if (!send) return console.log('Dry run. Add --send to erase.')
  for (const botName of bots) await erase(botName, chatIds[0])
}

main()
