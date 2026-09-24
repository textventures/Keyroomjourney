// Goblin Tamer (@goblintamer_bot): through the Labyrinth to the Goblin Boss.
// Ported from saycubed/goblin-bot. Its old goblin tamer rooms are replaced by the shared Journey rooms.
const { playerName } = require("../lib/rooms");

module.exports = function setupGoblin(bot, { announce, ROOMS }) {

bot.command("respawn", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "This will respawn you with the Goblin Tamer?",
    {
      reply_markup: {
        inline_keyboard: [[{ text: "Respawn", callback_data: "begin" }]],
      },
    }
  );
  // this sends a message to the Goblin tamer respawn room
  announce(ROOMS.RESPAWN, `UserName: ${playerName(ctx.from)} has respawned`);
});

//this has two inline options- begin and end
bot.command("start", (ctx) => {
  // ctx.reply sends message to the user that triggered the bot
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "Hark!! Who goes there!?! Hopefully a brave wizard. Well, you must be a badass already if you’re here; so we’re off to a good start already. This Goblin Boss is no joke. Your going to need the sharpest machete, I mean sword, and a lot of heart to keep going in the face of adversity and foul stenches.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Towards the stench", callback_data: "begin" },
            { text: "Not feeling brave", callback_data: "end" },
          ],
        ],
      },
    }
  );
  // this sends a message to the Goblin tamer logger room
  announce(ROOMS.LOGGER, `UserName: ${playerName(ctx.from)} started the bot`);
});


//this is the message for end, it returns users to the lobby assed wizards
bot.action("end", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    'Not feeling brave today? Go back to the other lobby assed wizards and tell them what you have seen.',
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "back to the lobby",
              url: "https://t.me/niftywizardslobby",
            },
            { text: "I can do this", callback_data: "begin" },
          ],
        ],
      },
    }
  );
});



//this is the message for begin, it has 2 choices door1 and door2
bot.action("begin", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "The foul, putrid stench of death lingers in the air as you enter into the unknown. Grasping your trusty blade your mind can't help but wonder how many wizards have passed through the Labyrinth successfully before you. As you progress deeper into the Labyrinth you reach 2 giant doors. Choose wisely.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Door 1", callback_data: "door1" },
            { text: "Door 2", callback_data: "door2" },
          ],
        ],
      },
    }
  );
});

/*
//this is a message for door2 it has one option respawn
bot.action("door2", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "You open the door to see something you probably shouldn’t have. Forever scarred, you run away weeping. ",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Wash your eyes with bleach and respawn", callback_data: "respawn" }],
        ],
      },
    }
  );
});
*/

//this is the message for door2, it has 1 choice respawn
bot.action("door2", (ctx) => {
  ctx.telegram.sendAnimation(ctx.chat.id,
    "https://tenor.com/view/dance-sexy-moves-oh-yeah-gif-14871496");
  
    setTimeout(function() {
    ctx.telegram.sendMessage(
    ctx.chat.id,
    "You open the door to see something you probably shouldn’t have. Forever scarred, you run away weeping.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "wash your eyes with bleach and respawn", callback_data: "begin" },
           
          ],
        ],
      },
    })
  },5000);
});

/*
bot.on("animation", (ctx) => {
  console.log (ctx)
})
*/



//this is the message for door1, it has 1 choice continue
bot.action("door1", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    '“Why did I have to wear my good cloak today?” You wonder to yourself as you attempt to avoid the endless puddles of blood blanketing the corridor floor. The piles of skulls sprawled about on the floor make you realize the path ahead has been taken before by many failed wizards. “This must be the way.”',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "keep going", callback_data: "keepgoing" },
          ],
        ],
      },
    }
  );
});

//this is the message for keepgoing, it has 2 choices reddoor and greendoor
bot.action("keepgoing", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "In your haste to be on the lookout for goblin minions you miss the tripwire at your ankles. Snapping back, you realize the wall is quickly closing in behind you!! Staying put you will surely not see the light of day again. You run to the end of the corridor to reach 2 doors. Hurry up and pick!!",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Red Door", callback_data: "reddoor" },
            { text: "Green Door", callback_data: "greendoor" },
          ],
        ],
      },
    }
  );
});

// message for reddoor it ends in death
bot.action("reddoor", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "Fool…don’t you know red means death. The door was a fake. You are squished thinner than a crepe. To try again type /respawn",
    {}
  );
  // this sends a message to the goblin tamer cemetery
  announce(ROOMS.CEMETERY, `UserName: ${playerName(ctx.from)} was killed by the red door.`);
});

//this is the message for greendoor, it has 1 choice darkness
bot.action("greendoor", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "Whew! That was a close call! You barely make it through the doorway before the wall comes crashing behind you, blocking your only hope of escaping. There’s no turning back now. But, by God, that smell is only getting worse!! You fight back the urge to vomit before lighting up a spliff to calm your nerves.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Proceed into the darkness", callback_data: "darkness" },
          ],
        ],
      },
    }
  );
});

//this is a message for darkness it has two choices engage and ignore
bot.action("darkness", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "Man that spliff hit the spot!! Musta been a rainbow height because now your floating along. Your bliss is suddenly interrupted by the clamor of shouting. You see a sea of arms and hands sticking out from the walls on both sides ahead. “Wtf was in that spliff…” As you get closer you realize the arms are sticking out through bars. Prisoners. They shout out to you. ",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Engage the prisoners", callback_data: "engage" },
            { text: "Pretend you don't hear", callback_data: "pretend" },
          ],
        ],
      },
    }
  );
});

// message for pretend it ends in death
bot.action("pretend", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    'Little did you know the prisoners were trying to warn you of the dangers ahead. You step on a pressure plate and meet a poisoned arrow to the chest that quickly ends your quest. To try again type /respawn',
    {}
  );
  // this sends a message to the goblintamer cemetery
  announce(ROOMS.CEMETERY, `UserName: ${playerName(ctx.from)} was shot by a poisoned arrow.`);
});


// the message for "engage" has two options break and high
bot.action("engage", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "Oh thank the universes you came along young wizard!! We are wizards of a past age that have been kept as prisoners for future meals for the Goblin Boss. Quickly now, go grab the key up ahead.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Break them out", callback_data: "break" },
            { text: "Paranoia is too HIGH", callback_data: "high" },
          ],
        ],
      },
    }
  );
});

// message for high it ends in death
bot.action("high", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    'You glaze over the situation and ultimately decide you cannot trust these crusty ass wizards. “What kind of idiot gets caugh…” You can’t even finish the thought before you turn the corner and face a wall of armed goblins. You are easily overwhelmed and taken prisoner. To try again type /respawn',
    {}
  );
  // this sends a message to the goblintamer cemetery
  announce(ROOMS.CEMETERY, `UserName: ${playerName(ctx.from)} was taken prisoner, raped and killed.`);
});

//the message for break has two options duck and tuck
bot.action("break", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "You realize you will need a team of wizards in order to defeat the Goblin Boss. With your wits gathered you grab the keys and begin to free the prisoners. Upon the last cage you feel a pressure plate sink under the weight of your foot. Quick no time to think!",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Duck", callback_data: "duck" },
            { text: "Tuck and roll", callback_data: "tuck" },
          ],
        ],
      },
    }
  );
});


// message for duck it ends in death
bot.action("duck", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "Arrows come flying from every direction and you are pierced through the heart. To try again type /respawn",
    {}
  );
  // this sends a message to the goblintamer cemetery
  announce(ROOMS.CEMETERY, `UserName: ${playerName(ctx.from)} was killed by arrows.`);
});


//You manage to dodge the volley of quarrels that comes crashing down! Tiptoeing about, you diligently free the final prisoners. Your new mob of wizards will make for a formidable squad indeed
//the message for "tuck"  has only one option
bot.action("tuck", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "You manage to dodge the volley of quarrels that comes crashing down! Tiptoeing about, you diligently free the final prisoners. Your new mob of wizards will make for a formidable squad indeed",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Let’s kick some goblin ass", callback_data: "kick" }],
        ],
      },
    }
  );
});

//the message for kick has two options tunnel1 and tunnel2
bot.action("kick", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "As your squad ventures deeper, you are met with a split in your path. Two tunnels emerge. The first, covered in a hazy mist. The faint outline of a sign ominously reading, 'Enter at your own risk!' The second tunnel, is filled with DU$T throughout the air. The destitute sign is covered in poop and barely hanging on by a thread. The thickness of the poop renders the sign unreadable.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Hazy Mist Tunnel", callback_data: "tunnel1" },
            { text: "DU$TY air Tunnel", callback_data: "tunnel2" },
          ],
        ],
      },
    }
  );
});


//the message for "tunnel2"  has only one option go back
bot.action("tunnel2", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "There is a loud crashing sound in the distance followed by a defining roar. The newly freed wizards suddenly make a break for it and head back the way you came from. You hear another roar in the shadows and prudently follow in close pursuit.",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Go back and kick some goblin ass", callback_data: "kick" }],
        ],
      },
    }
  );
});

//this is the message for tunnel1, it has 2 choices share and save
bot.action("tunnel1", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "A sudden gust of wind brings the now familiar smell of death and fecal matter to your nostrils. As you and your newly formed mob of unarmed wizards head into the unknown, you realize you still have more spliffs.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Share with the Squad", callback_data: "share" },
            { text: "Save it for Victory", callback_data: "save" },
          ],
        ],
      },
    }
  );
});


//this is the message for save, it has 1 choice abyss
bot.action("save", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "Good choice!! These wizards’ smoking prowess more than likely equates to that of lobby ass wizards since they’ve been rotting away for so long.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Keep going into the abyss", callback_data: "abyss" },
          ],
        ],
      },
    }
  );
});


//this is the message for share, it has 2 choices join and quiet
bot.action("share", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "Good choice!! The squad cheers with joy!! Morale is certainly boosted and the gang is in good spirits. A song begins to rally between the troops. 🎵🎵 🎵 Stoned Warlords we be thee!! Goblins beware were baked and free!! For we love to kill especially the Dusty Clan hehe!!🎵🎵🎵",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Join in with them", callback_data: "join" },
            { text: "Quiet the Troops", callback_data: "quiet" },
          ],
        ],
      },
    }
  );
});



// message for join it ends in death
bot.action("join", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "The stoutness of your singing voice rallies the troops even more!! So loud in fact that every goblin in the labyrinth is alerted to your location. You are trapped and killed. To try again, type /respawn",
    {}
  );
  // this sends a message to the JourneyLogger room
  announce(ROOMS.CEMETERY, `UserName: ${playerName(ctx.from)} was trapped and killed.`);
});


//this is the message for quiet, it has 2 choices magic and blade
bot.action("quiet", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "Shhhhh!!!!!! Encouraging the troops to slither in the shadows as you press on proved to be an astute choice. You turn the corner and find a hoard of sleeping goblins.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Use Magic", callback_data: "magic" },
            { text: "Swing your Blades", callback_data: "blade" },
          ],
        ],
      },
    }
  );
});

//this is the message for magic, it has 1 choice blade
bot.action("magic", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    'Man…you must be stoned. You completely forget these goblins are protected by an invisible veil rendering them immune to spells. Only cold, hard steel will do.',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Swing your Blades", callback_data: "blade" }],
        ],
      },
    }
  );
});

//this is the message for blade, it has 2 choices follow and run
bot.action("blade", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    'Good choice. Only knives appear to be effective against these little buggers. The vengeful mob of wizards make quick work slicing through the hapless goblins before them. The goblins stood no chance against the coordinated team attack.',
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Fight the Boss",
              url: "https://t.me/+V_xgSdPNL4paGxnO",
            },
            { text: "Chicken OUT", url: "https://t.me/niftywizardslobby" },
          ],
        ],
      },
    }
  );
});



//this is the message for ABYSS, it has 1 choice blade
bot.action("abyss", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    'All of a sudden the text from the Scroll of Dexterius the Mysterious comes to mind. You whisper the words to the troops. “Shadows are where spirits lie waiting ‘till the day you die. Blade doth flash, and they say Hurrah! More spirits. Come and play.” The troops seem intrigued….',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Inspire Further", callback_data: "inspire" }],
        ],
      },
    }
  );
});

//this is the message for Inspire, it has 2 choices magic2 and blade2
bot.action("inspire", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "Seizing the moment even further you continue even louder. “The sun doth rise, the moon doth glow. The demons lurketh down below. Cast off thy mortal flesh and sin and let the cycle start again.” The cheers echo down the tunnel. A gigantic wooden door swings open at the end and out pours the first onslaught of goblin warriors protecting their Goblin Boss.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Use Magic", callback_data: "magic2" },
            { text: "Swing your Blades", callback_data: "blade" },
          ],
        ],
      },
    }
  );
});



//this is the message for magic2, it has 1 choice blade
bot.action("magic2", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    'Your /mutio spell is pretty weak. You need to get that xp up wizard. Looks like only cold, hard steel is gonna work. At least that Wizardess you used to date would call you the Master of Stab & Poke!!',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Swing your Blades", callback_data: "blade" }],
        ],
      },
    }
  );
});

}
