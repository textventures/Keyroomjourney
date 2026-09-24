// Questor's New Hat (@Nwhatquestbot): a trip into town for a new hat, and a run-in with Abigor.
// Ported from textventures/newhatbot1.
const path = require('path')
const { playerName } = require('../lib/rooms')

const resource = (file) => path.join(__dirname, '..', 'resources', 'newhat', file)

module.exports = function setupNewHat(bot, { announce, ROOMS }) {

const welcomeMessage = `Welcome to "Questor's New Hat"!

A Telegram based choose your own adventure story.

This journey will only take a few minutes.

Please type /begin to start your journey or at anytime to restart the adventure.

`



bot.start((ctx) => ctx.reply(welcomeMessage))

  

// Start the journey  - Add Help bot to slash commands

bot.command('begin', (ctx) => {
   
    ctx.telegram.sendMessage(ctx.chat.id, `Your hat is in tatters and bears the stains of many failed spells and potions, so it is time to treat yourself to a new one.  You would have purchased one earlier, but you still carry the scars from your last shopping trip.  
    
    It is time to put your fears aside and head into town.  You desperately need a new hat and maybe if all goes well you can stop by the tavern for a pint afterwards.  Josephus, the Tavern Master brews some excellent ales.`,
   
    
  {
        reply_markup: {
            inline_keyboard: [
            [{text: "Walk into town.", callback_data: "Path1" }, {text: "Fly there on your broom.", callback_data: "Path20"}]
        ]
    }}
    );

// Send Start Message to Logger 

    announce(ROOMS.LOGGER, `UserName: ${playerName(ctx.from)} has started their journey`);

})

// Respawn code - Same messages as stage 1

bot.action('respawn', (ctx) => {

    ctx.telegram.sendMessage(ctx.chat.id, `Your hat is in tatters and bears the stains of many failed spells and potions, so it is time to treat yourself to a new one.  You would have purchased one earlier, but you still carry the scars from your last shopping trip.  
    
    It is time to put your fears aside and head into town.  You desperately need a new hat and maybe if all goes well you can stop by the tavern for a pint afterwards.  Josephus, the Tavern Master brews some excellent ales.`,
       

        {
         reply_markup: {
            inline_keyboard: [
             [{text: "Walk into town.", callback_data: "Path1" }, {text: "Fly on your broom.", callback_data: "Path20"}]
            ]
        }
            })

// Send respawn message to logger            

    announce(ROOMS.RESPAWN, `UserName: ${playerName(ctx.from)} has respawned`);

    })

 

//  Beginning of decision trees - Main Journey    

bot.action('Path1', (ctx) => {
    
   
    ctx.telegram.sendMessage(ctx.chat.id, `The town is very quiet today and the shop you would normally go to seems to be closed for the afternoon.  Odd, The Keeper, the proprietor is always in the shop.  He lives upstairs and really does not have much of a life outside of his store.  
    
    You travel further along the lane and meet a Wizard that is totally foreign to you.  He is dressed in all black robes. He is very handsome and well kempt, but something about him seems a little off.  He looks in your direction and beckons you over.  Always polite, you make your way over and say "Hello". He introduces himself as "Abigor" and states that he noticed you were looking into the shop across the road.  He mentions that he just opened his own shop and that business has been slow.  He asks if you would like to come in and take a look.   He is apparently having a sale!`, 
    
    {
        reply_markup: {
            inline_keyboard: [
            [{text: "Enter the shop.", callback_data: "Path3" }, {text: "Turn to leave.", callback_data: "Path30"}]
        ]
    }
        })
    })



bot.action('Path3', (ctx) => {
            
    ctx.telegram.sendMessage(ctx.chat.id, `From the outside, the shop looks bright and well lit, but when you enter, it seems darker than it should be.  The air is thick with the smell of age and decay.

    The hair on the back of your neck stands up and you turn to leave.  As you do, your eye is drawn to a hat in the middle of store.  You try to turn away, but it seems impossible.  Is it the hat, or is it the "SALE - 50% OFF" sign below it?
 
    You move towards the hat, seemingly in a trance and Abigor moves behind you.  "This hat was enchanted by Merlin himself!  It makes the wearer irresistible to all.  With this hat, you will always be the most handsome person in the room".
 
    You have a strong impulse to put the hat on, but you stumble and snap out of your trance.  There is something not quite right here...`, 
    
    
    {
        reply_markup: {
            inline_keyboard: [
            [{text: "Try on the hat.", callback_data: "Path5" }, {text: "Leave while you can!", callback_data: "Path60"}]
        ]
    }
         })
    })


bot.action('Path5', (ctx) => {
             
    ctx.telegram.sendMessage(ctx.chat.id, `The hat is surprisingly light and fits as if it was made for you.  You turn to ask Abigor what he thinks and you are shocked to see that his face has taken on a strange glow.
     
    The once handsome face has turned into a grotesque mask.  His skin has taken on the pallor of a corpse and his black eyes peer at you through narrow slits.  "Now you are mine", he hisses at you with breath that reeks of sulphur.
     
    Your mind races, who could this be?  It doesn't matter now!  You need to act!`, 

     {
        reply_markup: {
            inline_keyboard: [
            [{text: "Run from the store!", callback_data: "Path7" }, {text: "Grab your wand!", callback_data: "Path80"}]
        ]
        }
     })
})



bot.action('Path7', (ctx) => {


    ctx.telegram.sendMessage(ctx.chat.id, `As you turn to run you trip over your robe.  This is your spare robe and you just never found the time to have it hemmed.
    
    As you are falling you hear Abigor yell and see a green flash sail over your head.  You hit the ground and your wand flies from your robe and lands in your hand.

    You point your wand and yell "INCINDIO"!  Abigor erupts in green flames and vanishes.  That was a close call.  Who was Abigor and what did he want?  You can't help but feel that there is more to this story and that you and the town has not seen the last of Abigor.

    You pick yourself up from the carpet and are amazed that the hat is still on your head.  This is a damn nice hat!  Maybe you should see what else the store has to offer since you are alone now, but you would also like to see what this hat looks like.`,
    
    {
        reply_markup: {
           inline_keyboard: [
           [{text: "Look in the mirror.", callback_data: "Path9" }, {text: "Look around the shop.", callback_data: "Path70"}]
       ]
       }
    })
})



 bot.action('Path9', (ctx) => {
  
    ctx.reply("Whoa....  This is a damn fine hat!  Looking Good!")
 
// Send narcissist message to logger    
  
    announce(ROOMS.LOGGER, `UserName: ${playerName(ctx.from)} has got caught looking`);
  
    ctx.telegram.sendPhoto(ctx.chat.id, {source: resource("sexywizard.jpg")});

// Send Respawn after Timer


    setTimeout(function() {

    ctx.telegram.sendMessage(ctx.chat.id, `Whoa! That is enough, stop Looking at yourself!`, 
            
        {
        reply_markup: {
            inline_keyboard: [
            [{text: "Respawn", callback_data: "respawn" }]
        ]
        }
            })

        }, 3000);


  })


bot.action('Path20', (ctx) => {   
          
    ctx.telegram.sendMessage(ctx.chat.id, 'Are you sure you want to fly?  It has been a long time since you have been on your broom.  The last time you flew, you nearly ended up in the belly of a dragon. When you finally managed to get home you had to throw away your robe and underwear.  You are afraid your broom may still have a bit of stain. ', 
    {
        reply_markup: {
            inline_keyboard: [
            [{text: "Fly the friendly skies.", callback_data: "Path22" }, {text: "You decide to walk.", callback_data: "Path1"}]
         ]
         }
        })
    })



bot.action('Path22', (ctx) => {
   
    ctx.telegram.sendMessage(ctx.chat.id, 'You really are terrible at flying.  After narrowly missing the chimney of your neighbours cottage, you manage to land back at your house without hurting anything.  Perhaps it is better to walk after all.  You quickly pop into the cottage, change you shorts and off to town you go.',
    {
        reply_markup: {
            inline_keyboard: [
            [{text: "Walk Into town.", callback_data: "Path1" }]
        ]
    }
        })    
})


bot.action('Path30', (ctx) => {
             
    ctx.telegram.sendMessage(ctx.chat.id, `Abigor implores you to come in, but now you feel uneasy in his presence.  There is malice in his gaze that was not there a second ago and you are suddenly afraid that he may not be who or what he seems.  As you turn to leave, he reaches into his robe.  He is going for his wand.`, 
    
    {
        reply_markup: {
            inline_keyboard: [
            [{text: "Run away fast!", callback_data: "Path40" }, {text: "Reach for your wand!", callback_data: "Path50"}]
        ]
    }
        })
    })




bot.action('Path40', (ctx) => {
    
    ctx.telegram.sendMessage(ctx.chat.id, `You run as fast as you can.  The Level 2 Speed spell that came with your shoes, is really going to pay off today!  You scream the incantation "Zephyrus" and feel your legs go into overdrive.

    The street becomes a blur and you hear Abigor roar the words "IMOLATUS".  You turn the corner as a fireball sails directly over your head.  You smell sulphur and know that you hair has been singed.
  
    In an odd moment of clarity you think that your hair would have been fine if only you had a hat. The Tavern is directly across the road.
  
    You burst through the front door and yell for help.  No one even turns your way, apparently yelling for help is your speciality and they have heard enough.  Everyone else is thoroughly enjoying their pints and talking about the amount of DUST they made today!
  
   That is not how you expected this day to turn out.  You better head for home, but dammit, you still need a hat.`, 

   {
        reply_markup: {
            inline_keyboard: [
            [{text: "Head for home.", url: "https://t.me/joinchat/Un2kaKdtPhWXpgmQ" },{text: "Check out the Shop", callback_data: "Path70" }]
    ]
}
    })
 })





bot.action('Path50', (ctx) => {
  
    ctx.reply("It turns out that you are not that fast.  Before you even reach your wand Abigor yells 'IMOLATUS' and you are struck by a fireball.  Blazing heat envelops you, you feel the fireball sear into you and then…")

 
// Send death message to logger

    announce(ROOMS.CEMETERY, `UserName: ${playerName(ctx.from)} was struck by Abigor's fireball reaching for their wand outside his shop.`);

// Send Fiery Skull

    ctx.telegram.sendSticker(ctx.chat.id, {source: resource("fieryskull.tgs")});


// Respawn Timer

    setTimeout(function() {

    ctx.telegram.sendMessage(ctx.chat.id, `OUCH - That hurts!`, 
        
    {
        reply_markup: {
        inline_keyboard: [
        [{text: "Respawn", callback_data: "respawn" }]
    ]
    }
        })

    }, 3000);

})




bot.action('Path70', (ctx) => {
    
    ctx.telegram.sendMessage(ctx.chat.id, `On second thought, maybe you should just get out of here. 
    
    You quickly leave the store and see that The Keeper is standing outside of his store.  You run across the road and are about to tell The Keeper what just happened, but you see he is posting a sign on his window that reads: 
    
    _____________________________

    ***NEW ITEMS IN STOCK!***  
          CHECK OUT OUR
       FALL LINE OF HATS!
            50% OFF!
    _____________________________


    Your story can wait until later.  You still need a hat! `, 
   {
        reply_markup: {
            inline_keyboard: [
            [{text: "Look Around.", url: "https://t.me/joinchat/H7aO70x4iFJovONzSpFU7w" }]
    ]
}
    })

// Quest Completed Message to logger

    announce(ROOMS.LOGGER, `UserName: ${playerName(ctx.from)} has completed the quest`);
 })


bot.action('Path60', (ctx) => {
    
    ctx.reply(`You take three steps backwards and turn to leave, but Abigor is blocking your path.  "Leaving so soon", he coos.  "You haven't tried on this hat and I am sure it will fit you perfectly".  "No thank you", is all you can manage to say as fear wells up inside you.  
    
    Abigor begins muttering an incantation and you reach for your wand to defend yourself.  Too late!  Abigor's wand glows green and you are struck in the chest by a powerful blast.`) 
  

// Send death message to logger    

    announce(ROOMS.CEMETERY, `UserName: ${playerName(ctx.from)} was blasted by Abigor's green spell trying to leave his shop.`);

// Send Screaming Skull

    ctx.telegram.sendSticker(ctx.chat.id, {source: resource("screamingskull.tgs")});

// Respawn Timer

    setTimeout(function() {

    ctx.telegram.sendMessage(ctx.chat.id, `OUCH - That hurts!`, 
            
        {
        reply_markup: {
            inline_keyboard: [
            [{text: "Respawn", callback_data: "respawn" }]
        ]
        }
        })
    
    }, 3000);    
  
})



bot.action('Path80', (ctx) => {
  
    ctx.reply("It turns out that you are not that fast.  Before you even reach your wand Abigor yells 'IMOLATUS' and you are struck by a fireball.  Blazing heat envelops you, you feel the fireball sear into you and then….")
  
    
// Send death message to logger  
    
    announce(ROOMS.CEMETERY, `UserName: ${playerName(ctx.from)} was struck by Abigor's fireball reaching for their wand in the cursed hat.`);

// Send Fiery Skull

      ctx.telegram.sendSticker(ctx.chat.id, {source: resource("fieryskull.tgs")});


// Respawn Timer


    setTimeout(function() {

    ctx.telegram.sendMessage(ctx.chat.id, `OUCH - That hurts!`, 
            
        {
         reply_markup: {
            inline_keyboard: [
            [{text: "Respawn", callback_data: "respawn" }]
        ]
        }
            })
    
        }, 3000);

  })

}
