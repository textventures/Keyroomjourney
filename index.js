// Runs every Nifty Wizards textventure bot in one process, plus the web server for the Keyroom
// wallet sign-in page. Each bot has its own token in .env; a bot without a token is skipped.
require('dotenv').config()
const path = require('path')
const express = require('express')
const cookieParser = require('cookie-parser')
const { Telegraf } = require('telegraf')
const { ROOMS, addHerald, createAnnouncer } = require('./lib/rooms')
const { registerSigninRoutes } = require('./lib/wallets')

if (!process.env.PUBLIC_URL) {
  throw new Error('PUBLIC_URL environment variable is not set');
}

const BOTS = [
  // BOT_TOKEN is the Keyroom bot's original variable name
  { name: 'keyroom', tag: 'Keyroom Journey', token: process.env.KEYROOM_BOT_TOKEN || process.env.BOT_TOKEN, setup: require('./bots/keyroom') },
  // the tavern bot is in all three Journey rooms, so it posts for bots that haven't been added yet
  { name: 'tavern', tag: 'Tavern', token: process.env.TAVERN_BOT_TOKEN, setup: require('./bots/tavern'), herald: true },
  { name: 'newhat', tag: "Questor's New Hat", token: process.env.NEWHAT_BOT_TOKEN, setup: require('./bots/newhat') },
  { name: 'goblin', tag: 'Goblin Tamer', token: process.env.GOBLIN_BOT_TOKEN, setup: require('./bots/goblin') },
  { name: 'armsroom', tag: 'Arms Room', token: process.env.ARMSROOM_BOT_TOKEN, setup: require('./bots/armsroom') },
]

const expressApp = express()
expressApp.set('view engine', 'pug')
expressApp.set('views', path.join(__dirname, 'views'))
expressApp.use(cookieParser())
expressApp.use(express.json())
expressApp.use(express.urlencoded({ extended: false }))
expressApp.use('/static', express.static(path.join(__dirname, 'static')))
registerSigninRoutes(expressApp)

process.on('uncaughtException', function(error) {
  console.log('uncaughtException ' + error);
});

process.on('unhandledRejection', function(reason, p){
    console.log('unhandledRejection ' + reason);
});

const running = []

for (const config of BOTS) {
  if (!config.token) {
    console.log(`[${config.name}] no token set, skipping`)
    continue
  }
  const bot = new Telegraf(config.token)
  if (config.herald) addHerald(bot.telegram)

  // one bot's broken handler shouldn't take the others down
  bot.catch((error) => console.log(`[${config.name}] error: ${error.stack || error}`))

  // logs a group's id when the bot is added to it (groups upgraded to supergroups get new ids)
  bot.use((ctx, next) => {
    const member = ctx.update.my_chat_member
    if (member) {
      console.log(`[${config.name}] added to/removed from group: ${member.chat.id} "${member.chat.title}" (${member.chat.type}) now ${member.new_chat_member.status}`)
    }
    return next()
  })

  // type /roomid@<bot> in a group to get its id
  bot.command('roomid', (ctx) => {
    console.log(`[${config.name}] roomid: ${ctx.chat.id} "${ctx.chat.title || 'private'}" (${ctx.chat.type})`)
    return ctx.reply(`This chat's ID is ${ctx.chat.id}`)
  })

  config.setup(bot, { name: config.name, announce: createAnnouncer(config.tag, bot.telegram), ROOMS })

  bot.launch()
    .then(() => console.log(`[${config.name}] running as @${bot.options.username}`))
    .catch((error) => console.log(`[${config.name}] failed to start: ${error.description || error.message}`))
  running.push(bot)
}

// Enable graceful stop
process.once('SIGINT', () => running.forEach((bot) => bot.stop('SIGINT')))
process.once('SIGTERM', () => running.forEach((bot) => bot.stop('SIGTERM')))

const port = process.env.PORT || 3000
expressApp.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
