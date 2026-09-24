// Quest to the Tavern (@questtotavern_bot): from the Quests Chamber to the Tavern with Dwelryn.
// Ported from textventures/tavernbot.
const { playerName } = require("../lib/rooms");

module.exports = function setupTavern(bot, { announce, ROOMS }) {

bot.command("respawn", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "This will respawn you in the Quests Chamber. Do you wish to respawn?",
    {
      reply_markup: {
        inline_keyboard: [[{ text: "Respawn", callback_data: "begin" }]],
      },
    }
  );
  // this sends a message to the JourneyLogger room
  announce(ROOMS.RESPAWN, `UserName: ${playerName(ctx.from)} has respawned`);
});

//this has two inline options- begin and end

bot.command("start", (ctx) => {
  // ctx.reply sends message to the user that triggered the bot
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "This will take about 5 minutes! Are you ready to begin?",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "YES", callback_data: "begin" },
            { text: "NO", callback_data: "end" },
          ],
        ],
      },
    }
  );
  // this sends a message to the JourneyLogger room
  announce(ROOMS.LOGGER, `UserName: ${playerName(ctx.from)} started the bot`);
});

//this is the message for end
bot.action("end", (ctx) => {
  //ctx.deleteMessage()
  ctx.reply("We can try this another time. Come back when you are ready.");
});

//this is the message for begin, it has 2 choices village and dark
bot.action("begin", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    ' You meet a man who says, "I am Dwelryn the Journeyman. I will help you on the journey." You follow Dwelryn through a small door from the Quests Chamber and onto a dry dusty road. In one direction, you see the flickering lights of a village. In the other direction, you see only darkness. Which way will you go?',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Toward the village lights", callback_data: "village" },
            { text: "into the darkness", callback_data: "dark" },
          ],
        ],
      },
    }
  );
});

//this is a message for darkness it has one option sword
bot.action("dark", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "You walk together into the darkness. You soon have a strange feeling you are being watched",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Draw your sword", callback_data: "sword" }],
        ],
      },
    }
  );
});

// message for sword it ends in death
bot.action("sword", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "You draw your sword and start to speak, but it is too late, you feel cold steel pressing against your belly then you feel warm blood. You lay dying... on the road...in the silence ...in the darkness. To try again type /respawn",
    {}
  );
  // this sends a message to the journey cemetery
  announce(ROOMS.CEMETERY, `UserName: ${playerName(ctx.from)} was killed by darkriders.`);
});

//this is the message for village, it has 2 choices sword and hide
bot.action("village", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    'You walk along the road. The lights of the village are getting closer. Suddenly, from behind, you hear the sound of approaching hooves. Dwelryn hisses, "Darkriders are coming." ',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Draw your sword", callback_data: "sword" },
            { text: "Retreat to the shadows", callback_data: "hide" },
          ],
        ],
      },
    }
  );
});

//this is the message for hide, it has 2 choices road and stream
bot.action("hide", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "You and Dwelryn jump off the road and into the bushes. Seconds later, black cloaked figures on horseback speed past. Each of them carries a large sword stained and scabbed with blood and rust. You wait for a few minutes and then run to the bridge. There is a stream, leading to town, under the bridge",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "follow the road", callback_data: "road" },
            { text: "follow the stream", callback_data: "stream" },
          ],
        ],
      },
    }
  );
});

//this is the message for road, it has 2 choices sword2 and magic
bot.action("road", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "Dwelryn and you follow the road into town. You hear screams and crashes. You stop in the shadows just short of the town square where the Darkriders are relentlessly slashing the helpless townfolk. What will you do?",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "use your sword", callback_data: "sword2" },
            { text: "use your magic", callback_data: "magic" },
          ],
        ],
      },
    }
  );
});

//this is a message for sword2 it has two choices kill and yell
bot.action("sword2", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "You draw your sword and run at the dark riders in the town square. Dwelryn is beside you as you hack at the darkriders. Soon, Dwelryn and you have cleared the square of all the riders. Except one, that you spy running out of town. What will you do?",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "kill him too", callback_data: "kill" },
            { text: "yell 'tell your friends'", callback_data: "yell" },
          ],
        ],
      },
    }
  );
});

// the message for "magic" has two options kill and yell
bot.action("magic", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "You pull a scroll from your inventory and begin reading the arcane words printed upon the parchment. The odd thing about scroll magic is that you never know what it is going to do until after you have done it. You need to act fast and say the final word for the spell!",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "finish the spell", callback_data: "spell" },
            { text: "change to sword", callback_data: "sword2" },
          ],
        ],
      },
    }
  );
});

//the message for "mint # of scroll"  has only one option
bot.action("spell", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "Oh no! That is a Scroll of Unusual Sizes! It is too late, the scrolls magic has already started across the square towards the dark riders. The riders boney fists grow to the size of houses and they take the oportunity to squash a few. The dark riders continue to grow.",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Watch them grow more", callback_data: "grow" }],
        ],
      },
    }
  );
});
//the message for grow has two options kill and yell
bot.action("grow", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "The dark riders grow larger and larger until the universe just cant hold them anymore and they pop and vanish out of exisitance.\
 One rider seems to have escaped the magic. He takes one look at you and starts running out of town.\
What do you do?",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "kill him too", callback_data: "kill" },
            { text: "yell 'tell your friends'", callback_data: "yell" },
          ],
        ],
      },
    }
  );
});

//this is the message for stream, it has 2 choices read and walk
bot.action("stream", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "You jump down into the stream and walk under the bridge. The bridge is an old wide type made of stones and wide timber. You strike a match so you can see. The ground on the banks is littered with bottles and there is grafitti on the wall of the bridge.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Read the graffiti", callback_data: "read" },
            { text: "Keep walking", callback_data: "walk" },
          ],
        ],
      },
    }
  );
});

//this is the message for walk, it has 2 choices sword2 and magic
bot.action("walk", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "You walk in the stream towards town. You hear screams and crashes. You stop in shadows of the riverbank just under the town square where the Darkriders are relentlessly slashing the helpless townsfolk. What will you do?",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "attack with a sword", callback_data: "sword2" },
            { text: "attack with magic", callback_data: "magic" },
          ],
        ],
      },
    }
  );
});

//this is the message for read, it has 1 choice walk
bot.action("read", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    'Written on the wall you read, "What do you call a dark rider with two brain cells? --Pregnant" This is not the first visit of the dark riders.',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "keep walking down the stream", callback_data: "walk" }],
        ],
      },
    }
  );
});

//this is the message for yell, it has 2 choices follow and run
bot.action("yell", (ctx) => {
  //ctx.deleteMessage()
  ctx.telegram.sendMessage(
    ctx.chat.id,
    'You yell at the solitary dark rider, "tell your friends there is a new wizard in town!" You turn to Dwelryn to say thanks, and suddenly notice there is a crowd of happy townspeople around you. They start pulling you away from the townsquare. What do you Do?',
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "follow them",
              url: "https://t.me/joinchat/H9mfqFY7eIDpQRg8HNUd3A",
            },
            { text: "run from them", url: "https://t.me/niftywizardslobby" },
          ],
        ],
      },
    }
  );
});

// message for kill it ends in death
bot.action("kill", (ctx) => {
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "You draw your sword and run after the solitary dark rider. You lunge at him, but you have misjudged the distance. You fall to the ground and your head strikes a large rock. The pain shoots through your head and seconds later the world goes dark. To try again, type /respawn",
    {}
  );
  // this sends a message to the JourneyLogger room
  announce(ROOMS.CEMETERY, `UserName: ${playerName(ctx.from)} hit their head and died.`);
});

}
