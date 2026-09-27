// Dwelryn's Snow Queen quest, run by the tavern bot (@questtotavern_bot). Twice a day at random times
// Dwelryn asks in the tavern for a brave adventurer; the first to tap "I'll go!" takes the quest in a
// private chat with the bot, and the call in the tavern changes to "<name> went with Dwelryn".
const db = require('../db')
const { playerName, createAnnouncer } = require('../lib/rooms')

// Nifty Wizards - Tavern (TAVERN_GROUP_ID overrides, e.g. for testing)
const TAVERN_GROUP = Number(process.env.TAVERN_GROUP_ID) || -1001446738048
const ADMINS = ['534355880'] // Telegram user ids that may post a call right away with /dwelryncall
// the twice-daily calls only run once the story is ready: SNOWQUEEN_CALLS=on in .env
const CALLS_ENABLED = process.env.SNOWQUEEN_CALLS === 'on'

const CALLS_PER_DAY = 2
const MIN_GAP = 4 * 60 * 60 // seconds between calls, at least
const LATE_LIMIT = 2 * 60 * 60 // a call missed by more than this (bot was down) is skipped
const DAY = 24 * 60 * 60

const CALL_TEXT = 'Dwelryn the Journeyman bangs his tankard on the bar. "Are there any brave adventurers willing to chance their life to save the beautiful Snow Queen?"'

// The quest, one scene per step. choices lead to other scenes; death is how the player died (posted to
// the cemetery); win marks the end of the quest. Placeholder until the story outline is written up.
const SCENES = {
  start: {
    text: 'Dwelryn leads you out of the tavern and into the cold. "The Snow Queen has been taken," he says. "If we do not reach her before the frost moon rises, the whole realm freezes with her."',
    choices: [
      { text: 'Follow Dwelryn north', next: 'soon' },
    ],
  },
  soon: {
    text: 'The rest of this journey is still being written. Watch the tavern for Dwelryn\'s next call.',
  },
}

const now = () => Math.floor(Date.now() / 1000)

module.exports = function setupSnowQueen(bot, { ROOMS }) {
  // posted by the tavern bot, but tagged as its own game in the Journey rooms
  const announce = createAnnouncer('Snow Queen', bot.telegram)

  // two random times in the day starting at dayStart, at least MIN_GAP apart and at least MIN_GAP
  // after the last call already scheduled
  function scheduleDay(dayStart) {
    const last = db.prepare('SELECT MAX(due_at) AS at FROM snowqueen_calls').get().at || 0
    for (let attempt = 0; attempt < 1000; attempt++) {
      const times = Array.from({ length: CALLS_PER_DAY }, () => dayStart + Math.floor(Math.random() * DAY)).sort((a, b) => a - b)
      const spaced = times.every((t, i) => (i === 0 ? t - last : t - times[i - 1]) >= MIN_GAP)
      if (spaced) {
        for (const t of times) db.prepare('INSERT INTO snowqueen_calls (due_at) VALUES (?)').run(t)
        return
      }
    }
  }

  // keeps today's and tomorrow's calls (UTC days) scheduled
  function ensureSchedule() {
    const today = Math.floor(now() / DAY) * DAY
    for (const dayStart of [today, today + DAY]) {
      const count = db.prepare('SELECT COUNT(*) AS n FROM snowqueen_calls WHERE due_at >= ? AND due_at < ?').get(dayStart, dayStart + DAY).n
      if (count === 0) scheduleDay(dayStart)
    }
  }

  function callKeyboard(id) {
    return { inline_keyboard: [[{ text: "I'll go!", callback_data: `sq_claim:${id}` }]] }
  }

  // an unanswered call stops taking volunteers once the next one goes up
  async function closeOpenCalls() {
    const open = db.prepare('SELECT * FROM snowqueen_calls WHERE posted_at IS NOT NULL AND claimed_by IS NULL AND closed_at IS NULL').all()
    for (const call of open) {
      db.prepare('UPDATE snowqueen_calls SET closed_at = ? WHERE id = ?').run(now(), call.id)
      await bot.telegram.editMessageText(call.chat_id, call.message_id, undefined, `${CALL_TEXT}\n\nNo one answered Dwelryn's call.`)
        .catch((error) => console.log(`[snowqueen] couldn't close call ${call.id}: ${error.description || error.message}`))
    }
  }

  async function postCall(call) {
    if (!TAVERN_GROUP) {
      console.log('[snowqueen] call due, but TAVERN_GROUP is not set in bots/snowqueen.js')
      return
    }
    await closeOpenCalls()
    const message = await bot.telegram.sendMessage(TAVERN_GROUP, CALL_TEXT, { reply_markup: callKeyboard(call.id) })
    db.prepare('UPDATE snowqueen_calls SET posted_at = ?, chat_id = ?, message_id = ? WHERE id = ?')
      .run(now(), String(TAVERN_GROUP), message.message_id, call.id)
    console.log(`[snowqueen] posted call ${call.id} in the tavern`)
  }

  async function tick() {
    if (!CALLS_ENABLED) return
    try {
      ensureSchedule()
      const due = db.prepare('SELECT * FROM snowqueen_calls WHERE due_at <= ? AND posted_at IS NULL AND skipped = 0 ORDER BY due_at').all(now())
      for (const call of due) {
        if (now() - call.due_at > LATE_LIMIT) {
          db.prepare('UPDATE snowqueen_calls SET skipped = 1 WHERE id = ?').run(call.id)
          console.log(`[snowqueen] skipped call ${call.id}, missed while the bot was down`)
          continue
        }
        await postCall(call)
      }
    } catch (error) {
      console.log(`[snowqueen] ${error.stack || error}`)
    }
  }

  function sendScene(chatId, from, id) {
    const scene = SCENES[id]
    if (!scene) return
    if (scene.death) announce(ROOMS.CEMETERY, `UserName: ${playerName(from)} ${scene.death}`)
    if (scene.win) announce(ROOMS.LOGGER, `UserName: ${playerName(from)} saved the Snow Queen`)
    const extra = scene.choices
      ? { reply_markup: { inline_keyboard: [scene.choices.map((c) => ({ text: c.text, callback_data: `sq:${c.next}` }))] } }
      : {}
    return bot.telegram.sendMessage(chatId, scene.text, extra)
  }

  // "I'll go!": the first tap claims the call, the call message changes, and the player is sent to a
  // private chat with the bot (Telegram only lets a bot message someone who has started it)
  bot.action(/^sq_claim:(\d+)$/, async (ctx) => {
    const id = parseInt(ctx.match[1])
    const name = playerName(ctx.from)
    const claimed = db.prepare('UPDATE snowqueen_calls SET claimed_by = ?, claimed_name = ?, claimed_at = ? WHERE id = ? AND claimed_by IS NULL AND closed_at IS NULL')
      .run(String(ctx.from.id), name, now(), id)
    if (claimed.changes === 0) {
      const call = db.prepare('SELECT claimed_name FROM snowqueen_calls WHERE id = ?').get(id)
      return ctx.answerCbQuery(call && call.claimed_name ? `${call.claimed_name} already went with Dwelryn.` : 'Dwelryn has already left.')
    }
    await ctx.editMessageText(`${CALL_TEXT}\n\n⚔️ ${name} went with Dwelryn.`)
      .catch((error) => console.log(`[snowqueen] couldn't update call ${id}: ${error.description || error.message}`))
    announce(ROOMS.LOGGER, `UserName: ${name} went with Dwelryn to save the Snow Queen`)
    return ctx.answerCbQuery(undefined, false, { url: `https://t.me/${bot.options.username}?start=sq_${id}` })
  })

  // /start sq_<id> from the claim: only the player who claimed that call can start it
  bot.command('start', (ctx, next) => {
    const match = /^\/start(?:@\w+)?\s+sq_(\d+)$/.exec(ctx.message.text || '')
    if (!match) return next()
    const call = db.prepare('SELECT * FROM snowqueen_calls WHERE id = ?').get(parseInt(match[1]))
    if (!call || call.claimed_by !== String(ctx.from.id)) {
      return ctx.reply("Dwelryn looks you up and down. \"You're not the one who answered my call.\" Watch the tavern for his next call.")
    }
    if (!call.started_at) db.prepare('UPDATE snowqueen_calls SET started_at = ? WHERE id = ?').run(now(), call.id)
    return sendScene(ctx.chat.id, ctx.from, 'start')
  })

  bot.action(/^sq:(\w+)$/, (ctx) => {
    ctx.answerCbQuery()
    return sendScene(ctx.chat.id, ctx.from, ctx.match[1])
  })

  // for testing: post a call right away (admins only, in a private chat with the bot)
  bot.command('dwelryncall', async (ctx) => {
    if (!ADMINS.includes(String(ctx.from.id))) return
    const id = db.prepare('INSERT INTO snowqueen_calls (due_at) VALUES (?)').run(now()).lastInsertRowid
    await postCall({ id })
    return ctx.reply(TAVERN_GROUP ? 'Dwelryn has made his call in the tavern.' : 'TAVERN_GROUP is not set yet, so there is nowhere to post the call.')
  })

  if (!CALLS_ENABLED) console.log('[snowqueen] twice-daily calls are off (set SNOWQUEEN_CALLS=on to start them)')
  setTimeout(tick, 10 * 1000)
  setInterval(tick, 60 * 1000)
}
