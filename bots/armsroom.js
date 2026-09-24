// Quest to the Arms Room (@questtoarmsroombot): through goblins to the dragon Azgaroth the Fierce.
// Ported from the Python bot in textventures/questtoarmsroom_bot. The original replaced the button
// message with the outcome; now each outcome is a new message so the story stays in the chat.
const { playerName } = require('../lib/rooms')

const PATHS = [[
  { text: 'haunted forest', callback_data: '1' },
  { text: 'sweltering swamp', callback_data: '2' },
]]

const OUTCOMES = {
  '1': 'As you enter the Haunted Forest, you think to yourself “there’s no such thing as ghosts.” You take a deep breath and stride onwards and immediately find yourself in a goblin-filled pit. The ghosts might not be real, but the goblins certainly are! Use /stab to wield your knife, or /slash to draw your sword and prepare to fight your way out of the pit.',
  '2': 'In the sweltering swamp you spy a group of goblins getting inebriated on beer. A smart adventurer knows to never approach a drunken goblin. Alas, you are not a smart adventurer. \n \n You walk over to them and try to strike up a conversation. It fails miserably so you awkwardly laugh out loud for no reason.The goblins instantly hate you. They want to kill you and eat you for second breakfast… \n \n Choose /stab to pull out your knife or /slash to brandish your sword',
  '3': 'You think to yourself “it is best to flee, so that I may fight another day” and slowly back out of the goblin pit…  use /start to try the journey again',
  '4': 'You attempt to stab a goblin, but they are too quick for you and all you stab is the air. They descend upon you and you fall to the ground screaming. As you fade from consciousness, the last thing you hear is “yum, fresh human…” \n \n You have been killed. Use /revive to try the quest again. ',
  '5': 'The sword was the right choice for this fight. The goblins are quick and plentiful, but they don’t stand a chance against the weight of your mighty sword. You slash back and forth until not even one remains alive… \n \n You are victorious! Use /move to continue the quest.',
  '6': 'You and the Azgaroth get into a fierce battle, he tries to eviscerate you with his razor sharp claws, but at the last second, you jump out of the way. You throw a rock at him but he dodges. Then you remember what is in your cloak pocket – your trusty wand – which in some ways is more powerful than your knife or sword. With all the breath left in your lungs, you scream out “monstero begonist" while waiving your wand and just like that, Azgaroth is no more! As you stand there panting and drenched in sweat, you think to yourself “I wonder if they will write a song about me?” \n \n use /next to continue your journey',
}

module.exports = function setupArmsRoom(bot, { announce, ROOMS }) {
  bot.start((ctx) => {
    announce(ROOMS.LOGGER, `UserName: ${playerName(ctx.from)} started the bot`)
    return ctx.reply('Hi, and welcome to the “Quest to the Arms Room”. This will be a tough journey, so wield your weapons with all your might. To succeed you must make your way to the dragon “Azgaroth the Fierce” who dwells within the Castle Dread and defeat him. Please choose a path to take below:', {
      reply_markup: { inline_keyboard: PATHS },
    })
  })

  bot.command('revive', (ctx) => {
    announce(ROOMS.RESPAWN, `UserName: ${playerName(ctx.from)} used a heart to revive`)
    return ctx.reply('I see you used a heart to revive yourself and try to make your way to Azgaroth the Fierce again. Please choose a path to take below:', {
      reply_markup: { inline_keyboard: PATHS },
    })
  })

  bot.command('stab', (ctx) => ctx.reply('As you whip out your knife to battle, the goblins just laugh. Even simple creatures such as these know that a knife is a much weaker line of defense than a sword. Undeterred, you try and fight them with the knife anyway… \n \n Choose your next move below:', {
    reply_markup: { inline_keyboard: [[{ text: 'run away', callback_data: '3' }, { text: 'stay and fight', callback_data: '4' }]] },
  }))

  bot.command('slash', (ctx) => ctx.reply('You unsheathe your sword and as the sun reflects off its mirror-like surface the goblins begin to quiver in fear… \n \n What is your next move?', {
    reply_markup: { inline_keyboard: [[{ text: 'run away', callback_data: '3' }, { text: 'stay and fight', callback_data: '5' }]] },
  }))

  bot.command('move', (ctx) => ctx.reply('You move on to Castle Dread, and although there are many obstacles ahead, you can’t help but smile knowing that the treasure will soon be yours. You scale a wall, creep through the darkened corridors, and then you see it – the treasure trove. You think to yourself “that wasn’t very hard at all.” But then you see a pair of huge yellow eyes staring right at you! The dragon Azgaroth the Fierce sensed your presence and has awoken from his slumber… \n \n Choose your next move below', {
    reply_markup: { inline_keyboard: [[{ text: 'run away', callback_data: '3' }, { text: 'stay and fight ', callback_data: '6' }]] },
  }))

  bot.command('next', (ctx) => {
    announce(ROOMS.LOGGER, `UserName: ${playerName(ctx.from)} has completed the quest`)
    return ctx.reply('Congratulations. You have made it to the end of the adventure. Along the way you have learned about several of the items in the NiftyWizards game – namely the knife, the sword, the heart, and the wand. And you learned some of the game’s battle commands - /stab, /slash, and /revive. \n \n Choose your next destination wisely…', {
      reply_markup: { inline_keyboard: [[
        { text: 'Enter the Din of Sin', url: 'https://t.me/joinchat/dIUjtUtpkQQ5NjYx' },
        { text: 'Return to Whence You Came', url: 'https://t.me/joinchat/IQ5QKFJ9pGgo0jfCf2rByQ' },
      ]] },
    })
  })

  bot.action(/^[1-6]$/, (ctx) => {
    const choice = ctx.match[0]
    if (choice === '4') {
      announce(ROOMS.CEMETERY, `UserName: ${playerName(ctx.from)} stabbed at the air and was eaten by goblins.`)
    }
    if (choice === '6') {
      announce(ROOMS.LOGGER, `UserName: ${playerName(ctx.from)} defeated Azgaroth the Fierce`)
    }
    ctx.answerCbQuery()
    return ctx.reply(OUTCOMES[choice])
  })
}
