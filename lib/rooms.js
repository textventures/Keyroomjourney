// The three Journey rooms every textventure bot reports to. Each bot posts under its own name with a
// [Tag] in front, so the rooms show which game the player was in.
const ROOMS = {
  LOGGER: -442916137, // JourneyLogger: players starting a bot, and other milestones
  RESPAWN: -338860311, // Journey respawn logger
  CEMETERY: -429627900, // Journey Cemetery: deaths, and how they happened
}

// Bots that are in all three rooms and can post for a bot that hasn't been added to a room yet.
const heralds = []

function addHerald(telegram) {
  heralds.push(telegram)
}

function playerName(from) {
  return from.username || from.first_name
}

// announce(room, text) for one bot: posts as that bot, falling back to a herald if it can't.
// Never throws, so a room post can't interrupt the game.
function createAnnouncer(tag, telegram) {
  return async function announce(room, text) {
    const message = `[${tag}] ${text}`
    for (const sender of [telegram, ...heralds.filter((herald) => herald !== telegram)]) {
      try {
        await sender.sendMessage(room, message)
        return
      } catch (error) {
        console.log(`[${tag}] announce to ${room} failed: ${error.description || error.message}`)
      }
    }
  }
}

module.exports = { ROOMS, addHerald, playerName, createAnnouncer }
