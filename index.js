const {Telegraf} = require('telegraf')
const bot = new Telegraf('1503604925:AAFyMnXOycEuoAtfy1TO1cE_FoOnSgFp2eg')
const mongo = require("./db");
const axios = require('axios');
//const { Composer } = require('micro-bot')
const ASSET_TEMPLATE_ID = 79;
const KeyRoomLogger = -437551904
//const bot = new Composer

const express = require('express')
const expressApp = express()

const port = process.env.PORT || 3000
expressApp.get('/', (req, res) => {
  res.send('Hello World!')
})
/*expressApp.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
//bot.hears(/./, (ctx) => ctx.reply('Hello'))
bot.startPolling() */

//this is a respawn
bot.command("respawn", (ctx) =>{
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
    // ctx.reply sends message to the user that triggered the bot
    ctx.telegram.sendMessage(ctx.chat.id, 'This will take less than 5 minutes! Do you want to start?',
      {
         reply_markup: {
             inline_keyboard: [
                 [{text: "YES", callback_data: "begin"}, {text: "NO", callback_data: "end"}]
            ]
        }
    })
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


//this is the message for begin, it has 2 choices school and gang
bot.action('allow', (ctx) =>{
    //ctx.deleteMessage()
    ctx.telegram.sendMessage(ctx.chat.id, ' You see two doors at the far end of the lobby. Each door has a knob and a keyhole but that is where the similarities end. One door is ornate with gold leaf, fancy but a bit gaudy, the other is wood and metal, rustic and utilitarian. The doors have signs over them! Read the sign and choose a door!',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "Wizard School", callback_data: "school"}, {text: "Wizard Gang", callback_data: "gang"}]
            ]
        }
    })
})

//We will use this to check for a key in players inventory
bot.action('begin', (ctx) =>{
    //ctx.deleteMessage()
    ctx.telegram.sendMessage(ctx.chat.id, 'Please sign into your wax wallet to begin.',
        {
            reply_markup: {
                inline_keyboard: [
                    [{text: "Sign into Wax Cloud Wallet", url: `https://nifty-wizards.herokuapp.com/?chat_id=${ctx.chat.id}&name=${ctx.update.callback_query.from.username}`}]
                ]
            }
        })
})
   
  

bot.command("key", async (ctx) => {
    const db = mongo.db('wax');
    const collection = db.collection('users');
    let user = await collection.findOne({chat_id: ctx.chat.id.toString()});
    const url = `https://wax.api.atomicassets.io/atomicassets/v1/accounts/${user.address}`;
    axios
      .get(url, {
        params: {
          collection_whitelist: "niftywizards",
        },
      })
      .then(
        (response) => {
          if (response.data.data.assets === 0) {
            //ctx.reply(`You don't have a key 1.`);
            ctx.telegram.sendMessage(
                ctx.chat.id,
                `You don't have a key. Buy one on Atomic or find one in the lobby.`,
                {
                    reply_markup: {
                        inline_keyboard: [
                        [{text: "buy a key", url: "https://wax.atomichub.io/profile/aur5i.wam?collection_name=niftywizards&match=Key&order=desc&seller=aur5i.wam&sort=created&state=0,1,4&symbol=WAX#listings"}, {text: "find a key", url: "https://t.me/niftywizardslobby"}],
                        [{text: "try signing in again", callback_data: "begin"}]
                    ]
                    },
                }
                console.log(response);
            );
            return;
          }
          template_found = false;
          response.data.data.templates.forEach((template) => {
            if (parseInt(template.template_id) === ASSET_TEMPLATE_ID) {
              //ctx.reply(
                //`You have ${template.assets} key(s).`
                ctx.telegram.sendMessage(
                    ctx.chat.id,
                    `You have ${template.assets} key(s). Keys can open doors.`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                            [{text: "Open a door", callback_data: "allow"}]
                        ]
                        },
                    }
                );
              //);
              
              template_found = true;
              return;
            }
          });
          if(template_found) {
              return;
          }
          
          ctx.reply(`"You don't have a key. Buy one on atomic or find one in the lobby.`);
         
        },
        (error) => {
          console.log(error);
          //ctx.reply(`"You don't have a key 2.`);
          ctx.telegram.sendMessage(
            ctx.chat.id,
            `You don't have a key. Buy one on Atomic or find one in the lobby.`,
            {
                reply_markup: {
                    inline_keyboard: [
                    [{text: "buy a key", url: "wax.atomic.io"}, {text: "find a key", url: "t.me/lobby"}],
                    [{text: "Enter your address again", callback_data: "begin"}]
                ]
                },
            }
        );
         
        }
        
      );
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
 
//this is the message for gang, it has 2 choices gangpromise and gangcross
bot.action('gang', (ctx) =>{
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
bot.action('school', (ctx) =>{
    //ctx.deleteMessage()
    ctx.telegram.sendMessage(ctx.chat.id, 'Inside the door there is an equally ornate room with high ceilings and framed pictures on the wall. Everyone looks very important. There is a window at the far end of the room with a cut out to talk through and a slot for papers. A paper comes through the slot and a voice says "fill this out". The paper asks, DO YOU PROMISE TO OBEY AND UPHOLD THE SOLEMN WIZARD CODE?',
    {
        reply_markup: {
            inline_keyboard: [
                [{text: "YES", callback_data: "promise"}, {text: "NO", callback_data: "cross"}]
            ]
        }
    })
})

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

;(async function () {
    try {
        await mongo.connect();
        console.log("Succesfully connected to database");
    } catch (err) {
        console.log(err);
    }
}())

bot.launch({
    webhook: {
      domain: 'https://keyroomjourney.herokuapp.com/',
      port: process.env.PORT
    }
  })
 // module.exports = bot
