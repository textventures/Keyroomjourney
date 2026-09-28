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

const TAVERN_LINK = 'https://t.me/joinchat/H9mfqFY7eIDpQRg8HNUd3A'

// what's left of a quest once its conversation has been erased
const HAZY = "My memory of my time in the keep is hazy. I don't know if it was real or a dream."
// for a player still on their quest when Dwelryn's next call goes up
const SLEEPY = `You are feeling sleepy from all the walking, so you lie down for a rest.\n\nYou wake up outside the tavern. ${HAZY}`

// The quest, one scene per step. Each choice leads to another scene (next), into a room of the keep
// (room) or opens a link (url). death is how the player died (posted to the cemetery), log is a
// milestone for the logger, respawn goes to the respawn room, win marks saving the Snow Queen (which
// ends the quest), tavern(name) is posted in the tavern, and defeated ends the quest without winning:
// defeated.log goes to the logger and defeated.call(name) is a new call in the tavern a minute later.
const SCENES = {
  start: {
    text: 'Dwelryn leads you out of the tavern and through the town without saying a word. Only when the town is behind you and the forest closes in around the road does his mood brighten.\n\n"I am only happy when I am on a journey," he tells you. "North, East, South and West are my only friends and my only family."\n\nHe looks over at you. "When are you most happy?"',
    choices: [
      { text: 'Drinking', next: 'keep' },
      { text: 'Killing', next: 'keep' },
    ],
  },
  keep: {
    text: 'Dwelryn laughs. "The tavern is a great place to wash away the taste of the blood of your enemy."\n\nHe points up at the ruins of an abandoned castle keep on the hill. "That is your next opponent! Please, bring back the Snow Queen."',
    choices: [
      { text: 'Walk to the Castle Keep', next: 'castle' },
      { text: 'Return to the tavern', next: 'turnback' },
    ],
  },
  castle: {
    text: 'You leave the road and climb toward the ruined keep. At the front gates two large doors lead inside, but to the west there is a breached wall that looks big enough to slip through.',
    choices: [
      { text: 'Go through the front doors', room: '1' },
      { text: 'Slip through the breached wall', room: '5' },
      { text: 'Return to the tavern', next: 'retreat' },
    ],
  },
  // giving up outside the keep: ends the quest, and Dwelryn calls for someone else a minute later
  retreat: {
    text: 'You turn your back on the keep and trudge down the hill, all the way back to the tavern. The Snow Queen will have to wait for a braver adventurer.',
    defeated: { log: 'returned to the tavern defeated', call: (name) => `Dwelryn stumbles back into the tavern alone. "${name} has been defeated!" He bangs his tankard on the bar. "Are there any brave adventurers willing to chance their life to save the beautiful Snow Queen?"` },
    choices: [
      { text: 'Back to the tavern', url: TAVERN_LINK },
    ],
  },
  // reached by pushing a wobbly inner wall: north of rooms 1-3 and 28-30, east of 6, 8, 10 and 12,
  // south of 16-21, west of 23-26
  grand: {
    text: 'You push, and the wall swings open into a grand room in the middle of the castle.\n\nYou see the Snow Queen in a cage hanging from a tree.',
    log: 'found the Snow Queen',
    choices: [
      { text: 'Rush to her', next: 'rush' },
      { text: 'Look for the rope', next: 'rope' },
    ],
  },
  rush: {
    text: 'You rush toward the cage. Out of the shadows steps the Blue Wizard and swings his club at your head.\n\n"Buy all the URLs and you can be as strong as me!" he proclaims, as everything goes dark.\n\nYou have been killed.',
    death: 'was clubbed to death by the Blue Wizard',
    choices: [
      { text: 'Respawn outside the front gates', next: 'respawn' },
    ],
  },
  respawn: {
    text: 'You wake up in the snow outside the front gates of the keep. Two large doors lead inside, and to the west the breached wall looks big enough to slip through.',
    respawn: 'respawned outside the front gates',
    choices: [
      { text: 'Go through the front doors', room: '1' },
      { text: 'Slip through the breached wall', room: '5' },
      { text: 'Return to the tavern', next: 'retreat' },
    ],
  },
  rope: {
    text: 'You search the grand room and find the rope that holds the cage. You untie it and let the cage down gently.\n\nWhen it reaches the ground the Snow Queen steps out, grabs a club and rushes to a grassy knoll. She swings with all her might.\n\n"URLs are so web 2.0!"\n\nThe Blue Wizard lies dead. The Snow Queen grabs you by the hand and leads you back to the tavern, where she tells everyone that she saved you.',
    win: true,
    tavern: (name) => `The doors fly open and the Snow Queen sweeps into the tavern with ${name} by the hand. "Everyone, listen!" she says. "I saved this one."`,
    choices: [
      { text: 'Back to the tavern', url: TAVERN_LINK },
    ],
  },
  turnback: {
    text: 'You turn back toward the lights of the town. Dwelryn watches you go without a word, then walks on toward the keep alone.',
    defeated: { log: 'turned back before the Castle Keep', call: (name) => `Dwelryn stomps back into the tavern, shaking the snow from his cloak. "${name} turned back before we even reached the keep!" He bangs his tankard on the bar. "Are there any brave adventurers willing to chance their life to save the beautiful Snow Queen?"` },
    choices: [
      { text: 'Back to the tavern', url: TAVERN_LINK },
    ],
  },
}

// Inside the castle keep players move by typing /east, /west, /north or /south. The map is written
// the way it was outlined: each room's doors lead to another room, WINDOW (climbs out, back outside
// the gates) or OUTSIDE (walks out). A door only needs writing on one side; the way back through it
// is filled in below unless the room lists it in oneWay. text is optional (a room without it just
// names its ways out).
const WINDOW = 'window'
const OUTSIDE = 'outside'
const SECRET = 'secret' // not listed as a door: a wobbly wall that pushes open into the grand room
const MAP = {
  1: { doors: { east: '30', west: '2', south: OUTSIDE, north: SECRET }, exit: 'You push open the front doors and step back out into the snow.' },
  2: { doors: { east: '1', west: '3', south: WINDOW, north: SECRET } },
  3: { doors: { east: '2', west: '4', south: WINDOW, north: SECRET } },
  4: { doors: { east: '3', west: '5', north: '6', south: WINDOW } },
  5: { doors: { east: '4', north: '7', west: WINDOW, south: OUTSIDE }, exit: 'You squeeze out through the broken corner and find yourself outside the keep again.' },
  6: { doors: { west: '7', north: '8', east: SECRET } },
  7: { doors: { north: '9', east: '6', west: WINDOW } },
  8: { doors: { west: '9', north: '10', east: SECRET } },
  9: { doors: { north: '11', west: WINDOW } },
  10: { doors: { north: '12', west: '11', east: SECRET } },
  11: { doors: { north: '13', west: WINDOW } },
  12: { doors: { north: '14', west: '13', east: SECRET } },
  13: { doors: { north: '15', west: WINDOW } },
  14: { doors: { north: WINDOW, east: '16', west: '15' } },
  15: { doors: { north: WINDOW, west: WINDOW } },
  16: { doors: { east: '17', north: WINDOW, south: SECRET } },
  17: { doors: { north: WINDOW, east: '18', south: SECRET } },
  18: { doors: { north: WINDOW, east: '19', south: SECRET } },
  19: { doors: { north: WINDOW, east: '20', south: SECRET } },
  20: { doors: { north: WINDOW, east: '21', south: SECRET } },
  21: { doors: { north: WINDOW, east: '22', south: SECRET } },
  22: { doors: { north: WINDOW, east: WINDOW, south: '23' } },
  23: { doors: { east: WINDOW, south: '24', west: SECRET } },
  24: { doors: { east: WINDOW, south: '25', west: SECRET } },
  25: { doors: { east: WINDOW, south: '26', west: SECRET } },
  26: { doors: { east: WINDOW, south: '27', west: SECRET } },
  27: { doors: { east: WINDOW, south: WINDOW, west: '28' } },
  28: { doors: { south: WINDOW, west: '29', north: SECRET } },
  29: { doors: { south: WINDOW, west: '30', north: SECRET } },
  30: { doors: { south: WINDOW, west: '1', north: SECRET } },
  // rooms 31 and 32 are still to be written
}
// what each room looks like; the list of its doors follows
const DESCRIPTIONS = {
  1: 'The entrance hall. Snow has drifted in under the great front doors, and rusted suits of armour stand guard along the walls.',
  2: 'An old guardroom. A card game sits unfinished on the table, the cards frozen to the wood.',
  3: 'An armoury stripped almost bare. Empty racks line the walls and a single broken spear lies on the floor.',
  4: 'A cold kitchen. Pots hang over a hearth that hasn\'t seen a fire in years, and icicles drip from the ceiling.',
  5: 'The corner of the keep where the outer wall has collapsed. Rubble and snow cover the floor, and in the south corner the broken wall opens to the outside.',
  6: 'A narrow chapel. The pews are toppled and frost has painted strange patterns across the stained glass.',
  7: 'The servants\' quarters. Rows of narrow beds stand along the walls, their blankets stiff with frost.',
  8: 'A library. Most of the books have rotted away, but one shelf of blue leather volumes looks oddly new.',
  9: 'A storeroom full of empty barrels. Something has been gnawing at the corners.',
  10: 'A trophy room. The mounted heads of great beasts stare down at you, their glass eyes glinting in the gloom.',
  11: 'A washroom with a cracked stone basin. The water in it has frozen solid around a single silver ring.',
  12: 'A map room. A great table shows the whole kingdom, and someone has drawn a blue circle around this keep.',
  13: 'A stairwell whose stairs have crumbled away. Wind whistles down from somewhere far above.',
  14: 'A gallery of portraits. Every face has been scratched out except one: a wizard in blue robes.',
  15: 'The north-west corner of the keep. Snow blows in from two sides and piles up in soft drifts.',
  16: 'A banquet hall. Plates and goblets are still laid out, dusted with snow like sugar.',
  17: 'A music room. A harp stands in the corner, and when the wind blows its strings hum on their own.',
  18: 'A bedchamber with a great canopied bed, its curtains torn to ribbons.',
  19: 'A dressing room. Gowns of white and silver hang in rows, all of them frozen stiff.',
  20: 'An observatory. A brass telescope points at the night sky through a broken window.',
  21: 'A throne room. The throne is carved from ice, and a cracked crown lies on its steps.',
  22: 'The north-east tower. Wind howls in from two sides.',
  23: 'A chamber lined with cages, every one of them empty and open.',
  24: 'An alchemist\'s workshop. Blue potions bubble quietly on the bench, as if someone left only moments ago.',
  25: 'A long hall of frozen mirrors. Your reflection seems a moment slow to follow you.',
  26: 'A kennel. Chains hang from the walls, and huge paw prints lead away through the snow.',
  27: 'The south-east corner of the keep. Snow drifts in from two sides.',
  28: 'A tapestry room. The tapestries show a queen of snow and ice, and a wizard in blue.',
  29: 'A counting room. Coins are scattered across the floor, and someone has scrawled on the wall: "BUY ALL THE URLS".',
  30: 'A cloakroom. Heavy fur cloaks hang on hooks, and one lies on the floor as if it was dropped in a hurry.',
}
// "The room seems familiar" when a player comes back to a room after passing through at least this many
// other rooms since they were last in it
const FAMILIAR_AFTER = 5

const DIRECTIONS = ['north', 'east', 'south', 'west']
const OPPOSITE ={ north: 'south', south: 'north', east: 'west', west: 'east' }

// MAP plus the way back through every door. Doors that disagree (room 1 east -> 2, but room 2 west
// -> 3) are logged at startup and the room's own listing wins.
function buildKeep(map) {
  const keep = {}
  for (const [id, room] of Object.entries(map)) keep[id] = { text: DESCRIPTIONS[id], ...room, doors: { ...room.doors } }
  for (const [id, room] of Object.entries(map)) {
    for (const [dir, to] of Object.entries(room.doors)) {
      if (to === WINDOW || to === OUTSIDE || to === SECRET || !keep[to] || (room.oneWay || []).includes(dir)) continue
      const back = keep[to].doors[OPPOSITE[dir]]
      if (back === undefined) keep[to].doors[OPPOSITE[dir]] = id
      else if (back !== id) console.log(`[snowqueen] map: room ${id} ${dir} -> ${to}, but room ${to} ${OPPOSITE[dir]} -> ${back}`)
    }
  }
  return keep
}
const KEEP = buildKeep(MAP)

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
      // extra calls (manual, or after someone gives up) don't count towards the two a day
      const count = db.prepare('SELECT COUNT(*) AS n FROM snowqueen_calls WHERE due_at >= ? AND due_at < ? AND extra = 0').get(dayStart, dayStart + DAY).n
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
      await bot.telegram.editMessageText(call.chat_id, call.message_id, undefined, `${call.text || CALL_TEXT}\n\nNo one answered Dwelryn's call.`)
        .catch((error) => console.log(`[snowqueen] couldn't close call ${call.id}: ${error.description || error.message}`))
    }
  }

  async function postCall(call) {
    if (!TAVERN_GROUP) {
      console.log('[snowqueen] call due, but TAVERN_GROUP is not set in bots/snowqueen.js')
      return
    }
    await closeOpenCalls()
    const text = call.text || CALL_TEXT
    const message = await bot.telegram.sendMessage(TAVERN_GROUP, text, { reply_markup: callKeyboard(call.id) })
    db.prepare('UPDATE snowqueen_calls SET posted_at = ?, chat_id = ?, message_id = ?, text = ? WHERE id = ?')
      .run(now(), String(TAVERN_GROUP), message.message_id, text, call.id)
    console.log(`[snowqueen] posted call ${call.id} in the tavern`)
    await fadeOldQuests()
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

  // --- the quest conversation, which fades like a dream when the player gives up or the next call goes up

  function remember(userId, messageId) {
    db.prepare('INSERT OR IGNORE INTO snowqueen_messages (user_id, message_id) VALUES (?, ?)').run(String(userId), messageId)
  }

  // a Snow Queen message in the player's private chat (where the chat id is the player's id), recorded
  // so it can be erased later
  async function say(chatId, text, extra = {}) {
    const message = await bot.telegram.sendMessage(chatId, text, extra)
    remember(chatId, message.message_id)
    return message
  }

  // deletes every recorded message of the player's quest (bots can delete both sides of a private chat
  // for 48 hours)
  async function eraseConversation(userId) {
    const ids = db.prepare('SELECT message_id FROM snowqueen_messages WHERE user_id = ?').all(String(userId)).map((r) => r.message_id)
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      try {
        await bot.telegram.callApi('deleteMessages', { chat_id: userId, message_ids: chunk })
      } catch (error) {
        for (const id of chunk) await bot.telegram.deleteMessage(userId, id).catch(() => {})
      }
    }
    db.prepare('DELETE FROM snowqueen_messages WHERE user_id = ?').run(String(userId))
  }

  // when a new call goes up, every earlier adventurer's quest ends and fades from memory. Anyone still
  // playing gets sleepy, lies down, and wakes up outside the tavern.
  async function fadeOldQuests() {
    const players = db.prepare('SELECT DISTINCT user_id FROM snowqueen_messages').all().map((r) => r.user_id)
    for (const userId of players) {
      const stillPlaying = db.prepare('UPDATE snowqueen_calls SET ended_at = ? WHERE claimed_by = ? AND won_at IS NULL AND ended_at IS NULL').run(now(), userId).changes > 0
      leaveRoom(userId)
      await eraseConversation(userId)
      const extra = stillPlaying ? { reply_markup: { inline_keyboard: [[{ text: 'Back to the tavern', url: TAVERN_LINK }]] } } : {}
      await bot.telegram.sendMessage(userId, stillPlaying ? SLEEPY : HAZY, extra)
        .catch((error) => console.log(`[snowqueen] couldn't message ${userId}: ${error.description || error.message}`))
    }
  }

  // the player's current quest: the latest call they claimed that they haven't won or given up yet
  function activeCall(userId) {
    return db.prepare('SELECT * FROM snowqueen_calls WHERE claimed_by = ? AND won_at IS NULL AND ended_at IS NULL ORDER BY claimed_at DESC LIMIT 1').get(String(userId))
  }

  const RECALL_DELAY = 60 // seconds after an adventurer gives up before Dwelryn calls again

  // the player gave up: their quest ends, and a minute later Dwelryn asks the tavern for someone else
  function defeat(from, defeated) {
    const call = activeCall(from.id)
    if (call) db.prepare('UPDATE snowqueen_calls SET ended_at = ? WHERE id = ?').run(now(), call.id)
    leaveRoom(from.id)
    announce(ROOMS.LOGGER, `UserName: ${playerName(from)} ${defeated.log}`)
    db.prepare('INSERT INTO snowqueen_calls (due_at, text, extra) VALUES (?, ?, 1)').run(now() + RECALL_DELAY, defeated.call(playerName(from)))
    setTimeout(tick, (RECALL_DELAY + 1) * 1000)
  }

  async function sendScene(chatId, from, id) {
    const scene = SCENES[id]
    if (!scene) return
    if (scene.death) announce(ROOMS.CEMETERY, `UserName: ${playerName(from)} ${scene.death}`)
    if (scene.log) announce(ROOMS.LOGGER, `UserName: ${playerName(from)} ${scene.log}`)
    if (scene.respawn) {
      announce(ROOMS.RESPAWN, `UserName: ${playerName(from)} ${scene.respawn}`)
      leaveRoom(from.id)
    }
    if (scene.win) {
      // the quest is over: record it, so it can't be won (and announced in the tavern) again
      const call = activeCall(from.id)
      if (call) db.prepare('UPDATE snowqueen_calls SET won_at = ? WHERE id = ?').run(now(), call.id)
      leaveRoom(from.id)
      announce(ROOMS.LOGGER, `UserName: ${playerName(from)} saved the Snow Queen`)
    }
    if (scene.tavern && TAVERN_GROUP) {
      bot.telegram.sendMessage(TAVERN_GROUP, scene.tavern(playerName(from)))
        .catch((error) => console.log(`[snowqueen] couldn't post in the tavern: ${error.description || error.message}`))
    }
    const button = (c) => {
      if (c.url) return { text: c.text, url: c.url }
      if (c.room) return { text: c.text, callback_data: `sq_room:${c.room}` }
      return { text: c.text, callback_data: `sq:${c.next}` }
    }
    const extra = scene.choices ? { reply_markup: { inline_keyboard: [scene.choices.map(button)] } } : {}
    if (scene.defeated) {
      // giving up: the whole conversation fades, leaving just this (which isn't erased later)
      defeat(from, scene.defeated)
      await eraseConversation(from.id)
      return bot.telegram.sendMessage(chatId, `${scene.text}\n\n${HAZY}`, extra)
    }
    return say(chatId, scene.text, extra)
  }

  // "There are doors to the north and east, and a window to the south. Type /north, /east or /south."
  function doorsText(room) {
    const ways = DIRECTIONS.filter((d) => room.doors[d] && room.doors[d] !== SECRET)
    if (ways.length === 0) return ''
    const list = (dirs) => (dirs.length === 1 ? dirs[0] : `${dirs.slice(0, -1).join(', ')} and ${dirs[dirs.length - 1]}`)
    const kinds = [
      ['door', ways.filter((d) => room.doors[d] !== WINDOW && room.doors[d] !== OUTSIDE)],
      ['window', ways.filter((d) => room.doors[d] === WINDOW)],
      ['way out', ways.filter((d) => room.doors[d] === OUTSIDE)],
    ].filter(([, dirs]) => dirs.length)
    const parts = kinds.map(([kind, dirs]) => `${dirs.length === 1 ? `a ${kind}` : `${kind}s`} to the ${list(dirs)}`)
    const commands = ways.map((d) => `/${d}`)
    const described = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
    return `There ${kinds[0][1].length === 1 ? 'is' : 'are'} ${described}. Type ${commands.length === 1 ? commands[0] : `${commands.slice(0, -1).join(', ')} or ${commands[commands.length - 1]}`}.`
  }

  // through a window or a way out (the room's exit text): back outside the keep, choosing the way in again
  async function leaveKeep(chatId, from, how, room) {
    leaveRoom(from.id)
    await say(chatId, how === WINDOW
      ? 'You climb through the window and drop down into the snow outside the keep.'
      : room.exit || 'You step back outside the keep.')
    return sendScene(chatId, from, 'castle')
  }

  // the player is outside the keep (or the quest is over); their visits so far are kept
  function leaveRoom(userId) {
    db.prepare('UPDATE snowqueen_positions SET room = NULL, updated_at = ? WHERE user_id = ?').run(now(), String(userId))
  }

  function enterRoom(chatId, from, id) {
    const room = KEEP[id]
    // a room that isn't written yet: the player stays where they were
    if (!room) return say(chatId, `That door is stuck fast. (Room ${id} is still being written.)`)
    const userId = String(from.id)
    const position = db.prepare('SELECT steps FROM snowqueen_positions WHERE user_id = ?').get(userId)
    const step = (position ? position.steps : 0) + 1
    const visit = db.prepare('SELECT last_step FROM snowqueen_visits WHERE user_id = ? AND room = ?').get(userId, id)
    // been here before, with at least FAMILIAR_AFTER other rooms in between
    const familiar = visit && step - visit.last_step - 1 >= FAMILIAR_AFTER
    db.prepare(`
      INSERT INTO snowqueen_positions (user_id, room, updated_at, steps) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET room = excluded.room, updated_at = excluded.updated_at, steps = excluded.steps
    `).run(userId, id, now(), step)
    db.prepare(`
      INSERT INTO snowqueen_visits (user_id, room, last_step) VALUES (?, ?, ?)
      ON CONFLICT(user_id, room) DO UPDATE SET last_step = excluded.last_step
    `).run(userId, id, step)
    const description = room.text ? `${room.text}${familiar ? ' The room seems familiar.' : ''}\n\n` : ''
    return say(chatId, `Room ${id}\n\n${description}${doorsText(room)}`.trim())
  }

  const QUEST_OVER = "Dwelryn's call has ended. Watch the tavern for his next one."

  bot.action(/^sq_room:(\w+)$/, (ctx) => {
    if (!activeCall(ctx.from.id)) return ctx.answerCbQuery(QUEST_OVER)
    ctx.answerCbQuery()
    return enterRoom(ctx.chat.id, ctx.from, ctx.match[1])
  })

  // /east, /west, ... move a player who is inside the keep
  for (const direction of DIRECTIONS) {
    bot.command(direction, (ctx) => {
      if (ctx.chat.type !== 'private') return
      // during a quest, the player's command and the reply are part of the conversation that fades later
      const onQuest = !!activeCall(ctx.from.id)
      if (onQuest) remember(ctx.from.id, ctx.message.message_id)
      const reply = (text, extra) => (onQuest ? say(ctx.chat.id, text, extra) : ctx.reply(text, extra))
      const position = db.prepare('SELECT room FROM snowqueen_positions WHERE user_id = ?').get(String(ctx.from.id))
      if (!position || !position.room) return reply('There are no doors here.')
      const room = KEEP[position.room]
      if (!room || !room.doors[direction]) {
        return reply(`There is no way ${direction} from here.${room ? ` ${doorsText(room)}` : ''}`)
      }
      const target = room.doors[direction]
      if (target === SECRET) {
        return reply("That isn't a door, but the wall feels wobbly.", {
          reply_markup: { inline_keyboard: [[{ text: 'Push the wall', callback_data: 'sq:grand' }]] },
        })
      }
      if (target === WINDOW || target === OUTSIDE) return leaveKeep(ctx.chat.id, ctx.from, target, room)
      return enterRoom(ctx.chat.id, ctx.from, target)
    })
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
    const { text } = db.prepare('SELECT text FROM snowqueen_calls WHERE id = ?').get(id)
    await ctx.editMessageText(`${text || CALL_TEXT}\n\n⚔️ ${name} went with Dwelryn.`)
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
    // an old link to a quest that's over (won, given up, or faded when the next call went up)
    if (call.won_at || call.ended_at) return ctx.reply(QUEST_OVER)
    if (!call.started_at) db.prepare('UPDATE snowqueen_calls SET started_at = ? WHERE id = ?').run(now(), call.id)
    remember(ctx.from.id, ctx.message.message_id)
    // a new journey starts outside the keep, with no rooms visited yet
    db.prepare('DELETE FROM snowqueen_positions WHERE user_id = ?').run(String(ctx.from.id))
    db.prepare('DELETE FROM snowqueen_visits WHERE user_id = ?').run(String(ctx.from.id))
    return sendScene(ctx.chat.id, ctx.from, 'start')
  })

  // old buttons from a finished quest do nothing (e.g. tapping "Look for the rope" again)
  bot.action(/^sq:(\w+)$/, (ctx) => {
    if (!activeCall(ctx.from.id)) return ctx.answerCbQuery(QUEST_OVER)
    ctx.answerCbQuery()
    return sendScene(ctx.chat.id, ctx.from, ctx.match[1])
  })

  // for testing: post a call right away (admins only, in a private chat with the bot)
  bot.command('dwelryncall', async (ctx) => {
    if (!ADMINS.includes(String(ctx.from.id))) return
    const id = db.prepare('INSERT INTO snowqueen_calls (due_at, extra) VALUES (?, 1)').run(now()).lastInsertRowid
    await postCall({ id })
    return ctx.reply(TAVERN_GROUP ? 'Dwelryn has made his call in the tavern.' : 'TAVERN_GROUP is not set yet, so there is nowhere to post the call.')
  })

  if (!CALLS_ENABLED) console.log('[snowqueen] twice-daily calls are off (set SNOWQUEEN_CALLS=on to start them)')
  setTimeout(tick, 10 * 1000)
  setInterval(tick, 60 * 1000)
}
