if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.PORT || !process.env.VERIFICATION_TOKEN) {
    console.log('Error: Specify CLIENT_ID, CLIENT_SECRET, VERIFICATION_TOKEN and PORT in environment');
    process.exit(1);
}

var Q = require('q');
var Botkit = require('botkit');
var BotkitStorage = require('botkit-storage-mongo');
var mongoUri = process.env.MONGODB_URI || 'mongodb://localhost/welcomebot';
var slackCommands = {
    welcome: require('./commands/welcome.js')
};

var controller = Botkit.slackbot({ storage: BotkitStorage({mongoUri: mongoUri}) }).configureSlackApp(
    {
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        scopes: ['bot', 'commands', 'files:write:user'],
    }
);

var bot = controller.spawn({
    token: process.env.VERIFICATION_TOKEN
}).startRTM();

// A simple way to make sure we don't connect to the RTM twice for the same team
var _bots = {};
function trackBot(bot) {
    _bots[bot.config.token] = bot;
}

exports.controller = controller;

exports.connect = function( additonalSetup ){
    var deferred = Q.defer();

    controller.setupWebserver(process.env.PORT, function (err, webserver) {
        if( err ){
            deferred.reject( err );
        } else {
            deferred.resolve( webserver );
        }
    });

    return deferred.promise;
};

controller.on('rtm_open',function(bot) {
    console.log('** The RTM api just connected!');
});

controller.on('rtm_close',function(bot) {
    console.log('** The RTM api just closed');
});

controller.on('create_bot',function(bot,config) {
    if (_bots[bot.config.token]) {
        // already online! do nothing.
    } else {
        bot.startRTM(function(err) {
            if (!err) {
                trackBot(bot);
            }

            bot.startPrivateConversation({user: config.createdBy},function(err,convo) {
                if (err) {
                    console.log(err);
                } else {
                    convo.say('I am a bot that has just joined your team');
                    convo.say('You must now /invite me to a channel so that I can be of use!');
                }
            });
        });
    }
});

controller.on(['channel_joined', 'user_channel_join', 'user_group_join'], function(bot, message){
    bot.reply(message, {
        text: '<@' + message.user + '> Welcome to this channel! \n *Type `/welcome` to get a full overview of this channel! *'
    });
});

controller.on('slash_command', function (bot, message) {
    if( message.token !== process.env.VERIFICATION_TOKEN ) return;
    if( message.command === '/welcome' ){
        slackCommands.welcome.run(controller, bot, message);
    } else {
        bot.replyPublic(message, "I'm afraid I don't know how to " + message.command + " yet.");
    }
});

controller.storage.teams.all(function(err,teams) {
    if (err) {
        throw new Error(err);
    }

    // connect all teams with bots up to slack!
    for (var t  in teams) {
        if (teams[t].bot) {
            controller.spawn(teams[t]).startRTM(function(err, bot) {
                if (err) {
                    console.log('Error connecting bot to Slack:',err);
                } else {
                    trackBot(bot);
                }
            });
        }
    }
});

