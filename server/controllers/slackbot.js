/* Uses the slack button feature to offer a real time bot to multiple teams */
var Botkit = require('botkit');

if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.PORT || !process.env.VERIFICATION_TOKEN) {
    console.log('Error: Specify CLIENT_ID, CLIENT_SECRET, VERIFICATION_TOKEN and PORT in environment');
    process.exit(1);
}

var Q = require('q');
var BotkitStorage = require('botkit-storage-mongo');
var mongoUri = process.env.MONGODB_URI || 'mongodb://localhost/easy-peasy-slashcommand-app';
var config = {
    storage: BotkitStorage({mongoUri: mongoUri}),
};

var controller = Botkit.slackbot(config).configureSlackApp(
    {
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        scopes: ['bot', 'commands'],
    }
);

var bot = controller.spawn({
    token: process.env.VERIFICATION_TOKEN
}).startRTM();

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

// just a simple way to make sure we don't
// connect to the RTM twice for the same team
var _bots = {};
function trackBot(bot) {
  _bots[bot.config.token] = bot;
}

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

// Handle events related to the websocket connection to Slack
controller.on('rtm_open',function(bot) {
  console.log('** The RTM api just connected!');
});

controller.on('rtm_close',function(bot) {
  console.log('** The RTM api just closed');
  // you may want to attempt to re-open
});

controller.on(['channel_joined', 'user_channel_join', 'user_group_join'], function(bot, message){
    bot.reply(message, {
        text: '<@' + message.user + '> Welcome to this channel! \n *Type `/welcome` to get a full overview of this channel! *'
    });
});

controller.on('slash_command', function (bot, message) {
    if (message.token !== process.env.VERIFICATION_TOKEN) return;

    switch (message.command) {
        case "/welcome":
            var parts = message.text.trim().split(' ');

            if( parts[0].toLowerCase() === '' ){
                controller.storage.channels.get(message.channel, function(err, channel) {
                    if (!channel || !channel.welcomeFileId ) {
                        bot.replyPublic(message, 'Oh no! No welcome message has been setup.');
                        return;
                    }

                    bot.api.files.info({file: channel.welcomeFileId}, function(err, res){
                        if( err ){
                            bot.replyPublic(message, "Oh no! That file doesn't exist anymore!");
                        } else {
                            bot.replyPrivate(message, {
                                text: [
                                    '*' + res.file.title + '*',
                                    res.content,
                                    res.file.permalink
                                ].join('\n')
                            });
                        }
                    });
                });
            } else if( parts[0].toLowerCase() === "set" ){
                if( parts.length === 2){
                    var url = parts[1];
                    var urlParts = url.split('/');
                    var fileId = urlParts[ urlParts.length - 2 ];
                    bot.api.files.info({file: fileId}, function(err, res){
                        if( err ){
                            bot.replyPublic(message, "Oh no! That file doesn't exist!");
                        } else {
                            controller.storage.channels.get(message.channel, function(err, channel) {
                                if (!channel) {
                                    channel = {
                                        id: message.channel,
                                        welcomeFileId: null
                                    }
                                }

                                channel.welcomeFileId = fileId;

                                bot.replyPublic(message, {
                                    text: [
                                        'Set welcome message to: *' + res.file.title + '*',
                                        res.file.permalink
                                    ].join('\n')
                                });

                                controller.storage.channels.save(channel);
                            });
                        }
                    });
                }
                return;
            }
            break;
        default:
            bot.replyPublic(message, "I'm afraid I don't know how to " + message.command + " yet.");
            break;
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
