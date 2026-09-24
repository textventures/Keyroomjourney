require('dotenv').config()
const {Telegraf} = require('telegraf')

if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN environment variable is not set');
}

if (!process.env.PUBLIC_URL) {
  throw new Error('PUBLIC_URL environment variable is not set');
}

const bot = new Telegraf(process.env.BOT_TOKEN)
const db = require("./db");
const axios = require('axios');
const crypto = require('crypto');
//const { Composer } = require('micro-bot')
const ASSET_TEMPLATE_ID = 79;
const KeyRoomLogger = -437551904

// Rooms shared with the other Nifty Wizards bots (same ids as goblin bot). Posts are tagged so the
// rooms show which bot the player was in.
const CEMETERY = -701638493
const LOGGER = -781036554
const RESPAWN = -710478803
const ROOM_TAG = '[Keyroom Journey]'

function playerName(from) {
  return from.username || from.first_name;
}

// never let a failed room post (e.g. the bot isn't in that group) interrupt the game
function announce(room, text) {
  bot.telegram.sendMessage(room, `${ROOM_TAG} ${text}`)
    .catch((error) => console.log(`announce to ${room} failed: ${error.description || error.message}`));
}
//const bot = new Composer

const express = require('express')
const cookieParser = require('cookie-parser')
const expressApp = express()

const port = process.env.PORT || 3000
const signinUrl = process.env.PUBLIC_URL

expressApp.set('view engine', 'pug')
expressApp.use(cookieParser())
expressApp.use(express.json())
expressApp.use(express.urlencoded({ extended: false }))
expressApp.use('/static', express.static('static'))

// this serves the wax wallet sign-in page linked from the "begin" and "message" handlers below
expressApp.get('/', (req, res) => {
  res.render('index')
})

const SIGNIN_TOKEN_TTL_SECONDS = 24 * 60 * 60

// Each sign-in button gets its own one-time link, so the page never has to trust a chat id from the URL.
// door is the door the player was trying to open, if any, so it can be reopened after sign-in.
function createSigninLink(chatId, name, door = null) {
  const token = crypto.randomBytes(24).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  db.prepare('DELETE FROM signin_tokens WHERE expires_at < ?').run(now);
  db.prepare('INSERT INTO signin_tokens (token, chat_id, name, expires_at, door) VALUES (?, ?, ?, ?, ?)')
    .run(token, String(chatId), name, now + SIGNIN_TOKEN_TTL_SECONDS, door);
  return `${signinUrl}/?t=${token}`;
}

// the browser sign-in page posts the wax address it logged in with, plus the one-time token
expressApp.post('/api/link', async (req, res) => {
  if (typeof req.body.address !== 'string' || !/^[a-z1-5.]{1,12}$/.test(req.body.address)) {
    return res.status(400).send('Invalid wax address');
  }
  const session = db.prepare('SELECT * FROM signin_tokens WHERE token = ?').get(String(req.body.token));
  if (!session || session.expires_at < Math.floor(Date.now() / 1000)) {
    return res.status(401).send('This sign-in link has expired. Please get a new one from the bot.');
  }
  db.prepare('DELETE FROM signin_tokens WHERE token = ?').run(session.token);
  linkWallet(session.chat_id, req.body.address, session.name);

  // lets the sign-in page show the "no key" screen; null means the lookup failed
  let keys = null;
  try {
    keys = await countKeys(req.body.address);
  } catch (error) {
    console.log(error);
  }
  res.json({ ok: true, keys: keys, buyUrl: BUY_KEY_URL, findUrl: FIND_KEY_URL });

  // carry on in Telegram: reopen the door they were trying, or just confirm the new wallet
  try {
    await bot.telegram.sendMessage(session.chat_id, `Wallet ${req.body.address} is linked to your Telegram account and is now your active wallet. Use /wallets to add or switch wallets.`);
    if (session.door) {
      await tryDoor(session.chat_id, session.name, session.door);
    }
  } catch (error) {
    console.log(error);
  }
})

const BUY_KEY_URL = 'https://wax.atomichub.io/profile/aur5i.wam?collection_name=niftywizards&match=Key&order=desc&seller=aur5i.wam&sort=created&state=0,1,4&symbol=WAX#listings'
const FIND_KEY_URL = 'https://t.me/niftywizardslobby'

// number of Keyroom keys (niftywizards template ASSET_TEMPLATE_ID) the wax account holds
async function countKeys(address) {
  const response = await axios.get(`https://wax.api.atomicassets.io/atomicassets/v1/accounts/${address}`, {
    params: { collection_whitelist: 'niftywizards' },
  });
  const template = response.data.data.templates.find((t) => parseInt(t.template_id) === ASSET_TEMPLATE_ID);
  return template ? parseInt(template.assets) : 0;
}

// adds the wallet to the player's list and makes it their active wallet
function linkWallet(chatId, address, name) {
  db.prepare('INSERT OR IGNORE INTO wallets (chat_id, address, added_at) VALUES (?, ?, ?)')
    .run(chatId, address, Math.floor(Date.now() / 1000));
  db.prepare(`
    INSERT INTO users (chat_id, address, name) VALUES (?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET address = excluded.address, name = excluded.name
  `).run(chatId, address, name);
}

// the wallet used for key and inventory checks, or null if the player hasn't linked one
function getActiveWallet(chatId) {
  const user = db.prepare('SELECT address FROM users WHERE chat_id = ?').get(String(chatId));
  return user ? user.address : null;
}

function getWallets(chatId) {
  return db.prepare('SELECT address FROM wallets WHERE chat_id = ? ORDER BY added_at').all(String(chatId)).map((row) => row.address);
}

// Doors that need a Keyroom key. Each opens onto the start of its branch of the story.
const DOORS = {
  school: { name: 'Wizard School', enter: enterSchool },
  gang: { name: 'Wizard Gang', enter: enterGang },
}

// The player tries a door: sign in if they have no wallet, then check the active wallet for a key.
async function tryDoor(chatId, name, door) {
  const address = getActiveWallet(chatId);
  if (!address) {
    await bot.telegram.sendMessage(chatId, `The ${DOORS[door].name} door is locked. Sign in with your WAX wallet so we can check your pockets for a key.`, {
      reply_markup: {
        inline_keyboard: [
          [{text: "Sign into Wax Cloud Wallet", url: createSigninLink(chatId, name, door)}]
        ]
      }
    });
    return;
  }

  let keys;
  try {
    keys = await countKeys(address);
  } catch (error) {
    console.log(error);
    await bot.telegram.sendMessage(chatId, `We couldn't check your wallet for keys right now. Please try again in a moment.`, {
      reply_markup: {
        inline_keyboard: [
          [{text: "Try the door again", callback_data: door}]
        ]
      }
    });
    return;
  }

  if (keys > 0) {
    await bot.telegram.sendMessage(chatId, `You have ${keys} key(s) in ${address}. The key turns in the lock!`);
    await DOORS[door].enter(chatId);
    return;
  }

  const keyboard = [
    [{text: "buy a key", url: BUY_KEY_URL}, {text: "find a key", url: FIND_KEY_URL}],
    [{text: "Try the door again", callback_data: door}],
  ];
  if (getWallets(chatId).length > 1) {
    keyboard.push([{text: "Switch wallet", callback_data: "wallets"}]);
  }
  keyboard.push([{text: "Add another wallet", url: createSigninLink(chatId, name, door)}]);
  await bot.telegram.sendMessage(chatId, `You don't have a key in ${address}. Buy one on Atomic or find one in the lobby.`, {
    reply_markup: { inline_keyboard: keyboard }
  });
}

// The /wallets screen: every linked wallet with its key count. Tap one to make it active, or ✖ to unlink it.
async function walletsMessage(chatId, name) {
  const wallets = getWallets(chatId);
  const active = getActiveWallet(chatId);
  const addRow = [{text: "➕ Add a wallet", url: createSigninLink(chatId, name)}];
  if (wallets.length === 0) {
    return {
      text: `You haven't linked a WAX wallet yet.`,
      extra: { reply_markup: { inline_keyboard: [addRow] } },
    };
  }
  const counts = await Promise.all(wallets.map((address) => countKeys(address).catch(() => null)));
  const rows = wallets.map((address, i) => {
    const keys = counts[i] === null ? '?' : counts[i];
    return [
      {text: `${address === active ? '✅ ' : ''}${address} · ${keys} key(s)`, callback_data: `usewallet:${address}`},
      {text: "✖", callback_data: `rmwallet:${address}`},
    ];
  });
  rows.push(addRow);
  return {
    text: `Your WAX wallets. The ✅ wallet is used when the story checks your pockets. Tap a wallet to use it instead.\n\nAdding a Cloud Wallet account that's different from the one you're logged into? Log out at mycloudwallet.com first.`,
    extra: { reply_markup: { inline_keyboard: rows } },
  };
}

async function showWallets(ctx) {
  const { text, extra } = await walletsMessage(ctx.chat.id, ctx.from.username);
  return ctx.telegram.sendMessage(ctx.chat.id, text, extra);
}

// redraws the /wallets message in place after a change
async function refreshWallets(ctx) {
  const { text, extra } = await walletsMessage(ctx.chat.id, ctx.from.username);
  return ctx.editMessageText(text, extra).catch((error) => console.log(error));
}

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

process.on('uncaughtException', function(error) {
  console.log('uncaughtException ' + error);
});

process.on('unhandledRejection', function(reason, p){
    console.log('unhandledRejection ' + reason);
});

// logs a group's id when the bot is added to it, since groups upgraded to supergroups get new ids
bot.use((ctx, next) => {
    const member = ctx.update.my_chat_member;
    if (member) {
        console.log(`added to/removed from group: ${member.chat.id} "${member.chat.title}" (${member.chat.type}) now ${member.new_chat_member.status}`);
    }
    return next();
})

// type /roomid in a group to get its id for the room constants above
bot.command('roomid', (ctx) => {
    console.log(`roomid: ${ctx.chat.id} "${ctx.chat.title || 'private'}" (${ctx.chat.type})`);
    return ctx.reply(`This chat's ID is ${ctx.chat.id}`);
})

//this is a respawn
bot.command("respawn", (ctx) =>{
    // this sends a message to the respawn room
    announce(RESPAWN, `UserName: ${playerName(ctx.from)} has respawned`)
//console.log("bot.respawn");
    ctx.telegram.sendMessage(ctx.chat.id, 'This will respawn you in The Lobby. Do you wish to respawn?',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Respawn", callback_data: "begin"}]
            ]
        }
    })
})



bot.start(ctx => {
//console.log("bot.start");
    // ctx.reply sends message to the user that triggered the bot
    ctx.telegram.sendMessage(ctx.chat.id, 'This will take less than 5 minutes! Do you want to start?',
      {
         reply_markup: {
             inline_keyboard: [
                 [{text: "YES", callback_data: "begin"}, {text: "NO", callback_data: "end"}]
            ]
        }
    })
    // this sends a message to the shared logger room
    announce(LOGGER, `UserName: ${playerName(ctx.from)} started the bot`)
    // this sends a message to the keyroom logger
    ctx.telegram.sendMessage(KeyRoomLogger, `user @${ctx.from.username} started the bot`,  {
      reply_markup: {
      
      }
    });
  });

//this has two inline options- begin and end
//bot.start((ctx)=>{
//    ctx.telegram.sendMessage(ctx.chat.id, 'This will take less than 5 minutes! Do you want to start?',
  //  {
    //    reply_markup: {
      //      inline_keyboard: [
        //        [{text: "YES", callback_data: "begin"}, {text: "NO", callback_data: "end"}]
      //      ]
      //  }
  //  })
//})
//this is the message for end
bot.action('end', (ctx) =>{
    //ctx.deleteMessage()
    ctx.reply("We can try this another time. Come back when you are ready.")
})


//this is the lobby with the two doors, it has 2 choices school and gang
function showDoors(ctx) {
    ctx.telegram.sendMessage(ctx.chat.id, ' You see two doors at the far end of the lobby. Each door has a knob and a keyhole but that is where the similarities end. One door is ornate with gold leaf, fancy but a bit gaudy, the other is wood and metal, rustic and utilitarian. The doors have signs over them! Read the sign and choose a door!',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Wizard School", callback_data: "school"}, {text: "Wizard Gang", callback_data: "gang"}]
            ]
        }
    })
}

bot.action('begin', showDoors)
// older messages in players' chats still have "Open a door" buttons pointing here
bot.action('allow', showDoors)

//this lists the player's linked wallets and lets them add, switch or remove one
bot.command('wallets', showWallets)
bot.action('wallets', (ctx) => {
    ctx.answerCbQuery();
    return showWallets(ctx);
})

bot.action(/^usewallet:(.+)$/, (ctx) => {
    const address = ctx.match[1];
    if (!getWallets(ctx.chat.id).includes(address)) {
        return ctx.answerCbQuery('That wallet is no longer linked.');
    }
    db.prepare('UPDATE users SET address = ? WHERE chat_id = ?').run(address, String(ctx.chat.id));
    ctx.answerCbQuery(`Now using ${address}`);
    return refreshWallets(ctx);
})

bot.action(/^rmwallet:(.+)$/, (ctx) => {
    const chatId = String(ctx.chat.id);
    const address = ctx.match[1];
    db.prepare('DELETE FROM wallets WHERE chat_id = ? AND address = ?').run(chatId, address);
    if (getActiveWallet(chatId) === address) {
        // fall back to the most recently added wallet that's left, if any
        const next = getWallets(chatId).pop();
        if (next) {
            db.prepare('UPDATE users SET address = ? WHERE chat_id = ?').run(next, chatId);
        } else {
            db.prepare('DELETE FROM users WHERE chat_id = ?').run(chatId);
        }
    }
    ctx.answerCbQuery(`Removed ${address}`);
    return refreshWallets(ctx);
})

bot.on("message", (ctx) => {
    // the bot also sits in the shared rooms; only answer in private chats
    if (ctx.chat.type !== 'private') return;
    ctx.reply('Use /start to begin your journey, /respawn to return to the lobby, or /wallets to manage your WAX wallets.');
});
  
//bot.on('text',(ctx) =>{
  //  const address = ctx.message.text
  //  ctx.reply(`Your wax address is ${address}`)
  //  console.log(address)
  //  url = `https://wax.api.atomicassets.io/atomicassets/v1/accounts/${address}/niftywizards`
  //  axios.get(url)
  //  .then((res)=>{
      
  //      NWinventoryArr = Object.entries(res.data)
  //      //console.log(NWinventoryArr[0])
  //      NWkey = NWinventoryArr.filter((elem)=> {return elem.template_id == '79'})
   //     console.log(JSON.stringify(NWkey));
  //  })
  //  console.log(url)
//})
 
//choosing a door needs a key, see tryDoor
bot.action('school', (ctx) => tryDoor(ctx.chat.id, ctx.from.username, 'school'))
bot.action('gang', (ctx) => tryDoor(ctx.chat.id, ctx.from.username, 'gang'))

//this is the message for gang, it has 2 choices gangpromise and gangcross
function enterGang(chatId) {
    return bot.telegram.sendMessage(chatId, 'You open the door and it leads to a grimy, dimly lit back alley. You think you have gone the wrong way and grab for the door before it shuts. A dark figure emerges from the shadow, and deftly kicks the door closed! He grabs you by the collar and pulls your face close to his and whispers, "Want to become a wizard eh? DO YOU PROMISE TO FOLLOW AND UPHOLD THE SOLEMN WIZARD CODE?',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "YES", callback_data: "gangpromise"}, {text: "NO", callback_data: "gangcross"}]
            ]
        }
    })
}
//this is the message for school, it has 2 choices schoolallow and schooldeny
//bot.action('school', (ctx) =>{
    //ctx.deleteMessage()
 //   ctx.telegram.sendMessage(ctx.chat.id, 'Please enter your wax wallet address below so we can check for a key!',
  //  {
 //       reply_markup: {
 //           inline_keyboard: [
 //               [{text: "YES", callback_data: "promise"}, {text: "NO", callback_data: "cross"}]
 //           ]
 //       }
 //   })
//})

//this is the message for schoolallow, it has 2 choices promise and cross
function enterSchool(chatId) {
    return bot.telegram.sendMessage(chatId, 'Inside the door there is an equally ornate room with high ceilings and framed pictures on the wall. Everyone looks very important. There is a window at the far end of the room with a cut out to talk through and a slot for papers. A paper comes through the slot and a voice says "fill this out". The paper asks, DO YOU PROMISE TO OBEY AND UPHOLD THE SOLEMN WIZARD CODE?',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "YES", callback_data: "promise"}, {text: "NO", callback_data: "cross"}]
            ]
        }
    })
}

//this is the message for promise, it has 2 choices door and read
bot.action('promise', (ctx) =>{
    //ctx.deleteMessage()
    ctx.telegram.sendMessage(ctx.chat.id, 'A short plump wizard jumps out from a tiny door and shakes your hand, "Very good, an honourable promise. Your noble promise will get you far. You will learn to be a wizard with a few simple lessons designed to teach you about the mechanics of the NiftyWizard world". He leads you to a door, and motions for you to step through, but you spy some Wizard School brochures',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Open the door", callback_data: "door1"}, {text: "Read about the school", callback_data: "read"}]
            ]
        }
    })
})

//this is the message for cross, it has 2 choices door and read
bot.action('cross', (ctx) =>{
    //ctx.deleteMessage()
    ctx.telegram.sendMessage(ctx.chat.id, 'A very tall slender man opens a very tall slender door, he extends his hand to you but stops short of actually shaking it. He says to you, "Very wise decision, we cant blindly follow silly codes and customs. We need to think for ourselves. Your lessons start soon." He points to a door at the far end of the room. On your way to the door, you spy some school brochures.',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Open the door", callback_data: "door2"}, {text: "Read about the school", callback_data: "read6"}]
            ]
        }
    })
})

//this is a message for read it has one option read2
bot.action ('read', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'Wizard University: Perception and Observation 1010. Wizards must learn to observe the environment and notice deviation in our reality. Hone your perceptions with "The Awakening".',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Next Lesson", callback_data: "read2"}]
            ]
        }
    })
})

//this is a message for read2 it has one option read3
bot.action ('read2', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'Wizard University: Botany and Agriculture 1221. The key to sound ecological sorcery and sustainable witchcraft starts with collection and storage of seeds for future use. Find a sustainable source for your conjurations in "Magical Seeds".',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Next Lesson", callback_data: "read3"}]
            ]
        }
    })
})

//this is a message for read3 it has one option read4
bot.action ('read3', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'Wizard University: Financial Management 1331. You will study personal enchantment investment management. Learn to differentiate between true prestidigitation and mere jiggery-pokery with "Revelio Portfolio".',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Next Lesson", callback_data: "read4"}]
            ]
        }
    })
})

//this is a message for read4 it has one option read5
bot.action ('read4', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'Wizard University Communications 2600. We will study communication spells through Twitter. Display and describe your weapon inventory with the "bladeflasher".',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Next Lesson", callback_data: "read5"}]
            ]
        }
    })
})

//this is a message for read5 it has one option door1
bot.action ('read5', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'There are more classes to read about but the man from the window is giving you glances and motioning to the door.',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Open the Door", callback_data: "door1"}]
            ]
        }
    })
})

//this is a message for read6 it has one option read7
bot.action ('read6', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'Wizard University: Perception and Observation 1010. Wizards must learn to observe the environment and notice deviation in our reality. Hone your perceptions with "The Awakening".',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Next Lesson", callback_data: "read7"}]
            ]
        }
    })
})

//this is a message for read7 it has one option read8
bot.action ('read7', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'Wizard University: Botany and Agriculture 1221. The key to sound ecological sorcery and sustainable witchcraft starts with collection and storage of seeds for future use. Find a sustainable source for conjuration in "Magical Seeds".',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Next Lesson", callback_data: "read8"}]
            ]
        }
    })
})

//this is a message for read8 it has one option read9
bot.action ('read8', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'Wizard University: Financial Management 1331. You will study personal enchantment investment management. Learn to differentiate between true prestidigitation and mere jiggery-pokery with "Revelio Portfolio".',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Next Lesson", callback_data: "read9"}]
            ]
        }
    })
})

//this is a message for read9 it has one option read10
bot.action ('read9', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'Wizard University Communications 2600. We will study communication spells through Twitter. Display and describe your weapon inventory with the "bladeflasher".',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Next Lesson", callback_data: "read10"}]
            ]
        }
    })
})

//this is a message for read10 it has one option door2
bot.action ('read10', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'There are more classes to read about but the man from the window is giving you glances and motioning to the door.',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Open the Door", callback_data: "door2"}]
            ]
        }
    })
})



//this is a message for door1 it has two choices run1 and walk1
bot.action('door1', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id,'You open the door and a long hallway opens up in front of you. The floor slopes downward in a long undulating carpeted dragonsback. It would be fun to run down the hall. To your right is a sign that says, "WALK," in big bold letter, and under that in smaller but just as bold letters it says, "SLOWLY!" ',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Walk", callback_data: "walk1"}, {text: "Run", callback_data: "run1"}]
            ]
        }
    })
})

//this is a message for walk1 it has one option turn
bot.action ('walk1', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'You walk down the hall as the sign says. The floor is sloped and it is difficult to walk slowly. It would be fun to and easy to run. Your foot touches a panel in the floor and you hear a click. Seconds later fire blasts a few meters ahead of you. Exactly where you would have been if you were running! Further up the hall, you look down in time to notice a pit of spears, and walk around it. The hall way ends but there is a passgae to the right.',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Turn the corner", callback_data: "turn"}]
            ]
        }
    })
})

//this is a message for 'run1' it ends in death
bot.action('run1', (ctx) =>{
    // this sends a message to the cemetery
    announce(CEMETERY, `UserName: ${playerName(ctx.from)} was impaled on 1000 spears in the Wizard School hall.`)
    ctx.telegram.sendMessage(ctx.chat.id,'You run down the hall. It has rises and dips and it feels like you are flying as run up them and down the other side. You feel free and happy and the hall begins to spin around you. your feet crest over one of the small carpeted hills and suddenly you are flying, or falling! the hills have hidden a large drop to a deep spiked pit. You fall and are impaled on 1000 spears. To try again type /respawn'),
    {
        
    }
})

//this is a message for door2 it has two choices run2 and walk2
bot.action('door2', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id,'You open the door and a long hallway opens up in front of you. The floor slopes downward in a long undulating carpeted dragonsback. It would be fun to run down the hall. To your right is a sign that says, "WALK," in big bold letter, and under that in smaller but just as bold letters it says, "SLOWLY!',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Walk", callback_data: "walk2"}, {text: "run", callback_data: "run2"}]
            ]
        }
    })
})

//this is a message for 'walk2' it ends in death
//bot.action('walk2', (ctx) =>{
 //   ctx.telegram.sendMessage(ctx.chat.id,'You walk down the hall as the sign says. The floor is sloped and it is difficult to walk slowly. It would be fun to and easy to run down the slope and over the carpeted hills and valleys. Your daydream is broken as your back foot slips and falls downward, you scramble forward and notice that the floor behind you is falling away. It was a trap, the floor falls away and takes you down into an abyss to die!  To try again type /respawn')
//    {
//    })
    // this sends a message to the cemetery
 //       ctx.telegram.sendMessage -429627900, `UserName: ${ctx.from.username} walked when he should have run.`, {
//            reply_markup: {
//
//        }
 //   });
//});

//this is a message for 'walk2' it ends in death
bot.action('walk2', (ctx) =>{
    // this sends a message to the cemetery
    announce(CEMETERY, `UserName: ${playerName(ctx.from)} walked when they should have run and fell into the abyss.`)
    ctx.telegram.sendMessage(ctx.chat.id,'You walk down the hall as the sign says. The floor is sloped and it is difficult to walk slowly. It would be fun to and easy to run down the slope and over the carpeted hills and valleys. Your daydream is broken as your back foot slips and falls downward, you scramble forward and notice that the floor behind you is falling away. It was a trap, the floor falls away and takes you down into an abyss to die!  To try again type /respawn')
    {
        
    }
})
//this is a message for run2 it has one option turn
bot.action ('run2', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'You start to run down the hallway, and your foot senses a click under the carpet, a split second later 13 spears drop from the ceiling. It was a trap. You continue to run and the other various traps are set off and narrowly miss you as you bolt down the hallway. You smack into the wall at the end of the hall, panting, out of breath, but exilarated. There is another hallway leading to the right.',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "turn the corner", callback_data: "turn"}]
            ]
        }
    })
})

//this is the message for turn, it has 2 choices keyroom and lobby
bot.action('turn', (ctx) =>{
    //ctx.deleteMessage()
    ctx.telegram.sendMessage(ctx.chat.id, 'You turn the corner and the short hallway opens into a huge chamber full of student wizards. On one side fireballs are rising from fingertips, on the others side ravens are circling in the air, while a group of wizards chant an incomprehensible spell and laugh hysterically.',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Find someone to talk about magic", url: "https://t.me/joinchat/H9mfqFRr96HaYdu1vJgRWw"}, {text: "This is too weird", url: "https://t.me/niftywizardslobby"}]
            ]
        }
    })
})

//this is the message for gangallow, it has 2 choices gangpromise and gangcross
bot.action('gangallow', (ctx) =>{
    //ctx.deleteMessage()
    ctx.telegram.sendMessage(ctx.chat.id, 'You open the door and it leads to a grimy, dimly lit back alley. You think you have gone the wrong way and grab for the door before it shuts. A dark figure emerges from the shadow, and deftly kicks the door closed! He grabs you by the collar and pulls your face close to his and whispers, "Want to become a wizard eh? DO YOU PROMISE TO FOLLOW AND UPHOLD THE SOLEMN WIZARD CODE?',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "YES", callback_data: "gangpromise"}, {text: "NO", callback_data: "gangcross"}]
            ]
        }
    })
})

//this is the message for gangpromise, it has 2 choices tunnel and listen
bot.action('gangpromise', (ctx) =>{
    //ctx.deleteMessage()
    ctx.telegram.sendMessage(ctx.chat.id, 'Very good! Never cross the wizards and they will never cross you! He drags you down the alley and into a tavern called "The Blackmore." Inside a scruffy bunch of wizards are sitting, drinking and telling stories. They beckon your new friend over, and he tells you, "We can go right to the tunnels or you can listens to these old magicians for a while!"',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "descend to the tunnels", callback_data: "descend"}, {text: "Listen to Stories", callback_data: "listen"}]
            ]
        }
    })
})

//this is the message for gangcross, it has 2 choices descend and listen6
bot.action('gangcross', (ctx) =>{
    //ctx.deleteMessage()
    ctx.telegram.sendMessage(ctx.chat.id, 'Haha, correct answer, we live by our wits here! He drags you down the alley and into a tavern called "The Blackmore." Inside a scruffy bunch of wizards are sitting, drinking and telling stories. They beckon your new friend over, and he tells you, "We can go right to the tunnels or you can listens to these old magicians for a while!"',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "descend to the tunnels", callback_data: "descend2"}, {text: "Listen to Stories", callback_data: "listen6"}]
            ]
        }
    })
})

//this is a message for gangpromise listen it has one option listen2
bot.action ('listen', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'It might seem like a cliché, but most quests start off in a tavern and a meeting with a mysterious character, just like now. Find a local tavern with "The Journey", and make it a second home!',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Next story", callback_data: "listen2"}]
            ]
        }
    })
})

//this is a message for gangpromise listen2 it has one option listen3
bot.action ('listen2', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'I have "acquired" most of my treasure and skills by lurking around and looking for open doors of opportunity. Try your luck and find opportunity in "The Awakening".',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Next story", callback_data: "listen3"}]
            ]
        }
    })
})

//this is a message for gangpromise listen3 it has one option listen4
bot.action ('listen3', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'The real trick to surviving in the shire is knowing when to hold`em, when to fold`em, when to walk away, and when to run. Get a good idea of what you hold and its value through, "Revelio Portfolio".',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Next story", callback_data: "listen4"}]
            ]
        }
    })
})

//this is a message for gangpromise listen4 it has one option listen5
bot.action ('listen4', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'Another wizard says, you really have to scare your enemies. I like to use a twitter spell to show off my weapons. I call it "Bladeflasher".',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Next story", callback_data: "listen5"}]
            ]
        }
    })
})

//this is a message for gangpromise listen5 it has one option descend
bot.action ('listen5', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'The scruffy wizards are still talking and exchanging war stories but your friend nods subtly and motions to the stairs down to the tunnels. As you start down the stairs he yells, "Remember the wizard code, dont take anything from the dead." then slams the door leaving you in darkness.',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "descend to the tunnels", callback_data: "descend"}]
            ]
        }
    })
})

//this is a message for listen6 it has one option listen7
bot.action ('listen6', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'It might seem like a cliché, but most quests start off in a tavern and a meeting with a mysterious character, just like now. Find a local tavern with "The Journey", and make it a second home!',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Next Story", callback_data: "listen7"}]
            ]
        }
    })
})

//this is a message for listen7 it has one option listen8
bot.action ('listen7', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'I have "acquired" most of my treasure and skills by lurking around and looking for open doors of opportunity. Try your luck and find opportunity in "The Awakening".',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Next Story", callback_data: "listen8"}]
            ]
        }
    })
})

//this is a message for listen8 it has one option listen9
bot.action ('listen8', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'The real trick to surviving in the shire is knowing when to hold`em, when to fold`em, when to walk away, and when to run. Get a good idea of what you hold and its value through, "Revelio Portfolio".',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Next Story", callback_data: "listen9"}]
            ]
        }
    })
})

//this is a message for listen9 it has one option listen10
bot.action ('listen9', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'Another wizard says, you really have to scare your enemies. I like to use a twitter spell to show off my weapons. I call it "Bladeflasher".',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Next Story", callback_data: "listen10"}]
            ]
        }
    })
})

//this is a message for listen10 it has one option descend2
bot.action ('listen10', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'The scruffy wizards are still talking and exchanging war stories but your friend nods subtly and motions to the stairs down to the tunnels. As you start down the stairs he yells, "Remember dont take anything from the dead." then slams the door leaving you in darkness.',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Descend to the tunnels", callback_data: "descend2"}]
            ]
        }
    })
})



//this is a message for descend it has two choices take1 and leave1
bot.action('descend', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id,'You hold the damp wall as you descend into the tunnels feeling your way blindly. At the bottom of the stairs you find you are walking on an uneven surface. You reach into your pockets and find a pack of matches from The Blackmore. You strike a match and see you are standing on dead bodies, each skull has a gold coin over each eye.  ',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Take a few coins", callback_data: "take1"}, {text: "Keep walking", callback_data: "leave1"}]
            ]
        }
    })
})

//this is a message for Leave1 it has one option empty1
bot.action ('leave1', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'You keep walking and find a lantern. The tunnel opens up into a labyrinth of many passages. You wander the labyrinth, you do not even know what you are looking for. Suddenly you feel hot breath on your neck and turn to face a giant musceled beast with a human torso and a bull head. He bellows, "Pay the Price!" You search your pockets for some money, but they are empty. You wonder if you should have taken some coins? ',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Empty Your Pockets", callback_data: "empty"}]
            ]
        }
    })
})

//this is a message for 'take1' it ends in death
bot.action('take1', (ctx) =>{
    // this sends a message to the cemetery
    announce(CEMETERY, `UserName: ${playerName(ctx.from)} was gored by the minotaur for stealing from the dead.`)
    ctx.telegram.sendMessage(ctx.chat.id,'You keep walking and find a lantern. The tunnel opens up into a labyrinth. You wander the labyrinth, you do not even know what you are looking for. Suddenly you feel hot breath on your neck and turn to face a giant musceled beast with a human torso and a bull head. He bellows, "Pay the Price!" You grab the coins you took from the dead bodies. He bellows, "YOU STEAL FROM THE DEAD!" The minotaur charges, gores you with a horn, and your insides spill outside. To try again type /respawn')
    {
        
    }
})

//this is a message for descend2 it has two choices take2 and leave2
bot.action('descend2', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id,'You hold the damp wall as you descend into the tunnels feeling your way blindly. At the bottom of the stairs, you find you are walking on an uneven surface. You reach into your pockets to look for something useful and find a pack of matches from The Blackmore. You strike a match and see you are standing on dead bodies, each skull has a gold coin over each eye. ',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Take a Few Coins", callback_data: "take2"}, {text: "Keep Walking", callback_data: "leave2"}]
            ]
        }
    })
})

//this is a message for 'leave2' it ends in death
bot.action('leave2', (ctx) =>{
    // this sends a message to the cemetery
    announce(CEMETERY, `UserName: ${playerName(ctx.from)} was gored by the minotaur with empty pockets.`)
    ctx.telegram.sendMessage(ctx.chat.id,'You keep walking and find a lantern to light. The tunnel opens up into a labyrinth. You wander the labyrinth, you do not even know what you are looking for. Suddenly, you feel hot breath on your neck and turn to face a giant musceled beast with a human torso and a bull head. He bellows, "Pay the Price!" As you search your pockets, and wish you had taken a few coins, the minotaur gores you with a horn, and your insides spill outside. To try again type /respawn')
    {
        
    }
})

//this is a message for take2 it has one option empty
bot.action ('take2', (ctx) =>{
    ctx.telegram.sendMessage(ctx.chat.id, 'You keep walking and find a lantern to light. The tunnel opens up into a labyrinth. You wander the labyrinth, you do not even know what you are looking for. Suddenly you feel hot breath on your neck, and turn to face a giant musceled beast with a human torso and a bull head. He bellows, "Pay the Price!" You search your pockets and grab the coins you took from the dead bodies. Should you offer them as payment.',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Give him the coins", callback_data: "empty"}]
            ]
        }
    })
})

//this is the message for empty, it has 2 choices keyroom and lobby
bot.action('empty', (ctx) =>{
    //ctx.deleteMessage()
    ctx.telegram.sendMessage(ctx.chat.id, 'You empty your pockets and the Minotaur snorts, he roars and thrashes from side to side. One wall crumbles and he jumps through and runs. You peer in and in the distance you can hear, chanting, laughter, and cracks of whips and explosions! It sounds like a rowdy party. ',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Go through the break", url: "https://t.me/joinchat/H9mfqFRr96HaYdu1vJgRWw"}, {text: "Wander the labyrinth", url: "https://t.me/niftywizardslobby"}]
            ]
        }
    })
})


bot.launch()

expressApp.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
