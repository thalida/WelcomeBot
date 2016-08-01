var ALLOWED_ARGS = ['', 'help', 'edit', 'remove', 'set', 'set:file', 'set:text'];

var welcomeCommand = {
    run: function( controller, bot, message ){
        var args = this.processArgs( message );

        if( ALLOWED_ARGS.indexOf[args.key] === -1 ){
            bot.replyPublic(message, "I'm afraid I don't know how to " + message.command + " yet.");
            return;
        }

        var argFunc;

        switch( args.key ){
            case 'help':
                argFunc = this.help;
                break;
            case 'edit':
                argFunc = this.edit;
                break;
            case 'remove':
                argFunc = this.remove;
                break;
            case 'set':
            case 'set:text':
                argFunc = this.setText;
                break;
            case 'set:file':
                argFunc = this.setFile;
                break;
            default:
                argFunc = this.outputText;
                break;
        };

        argFunc( args, controller, bot, message );
    },
    processArgs: function( message ){
        var command = message.text.trim().split(/\s/, 1)[0];
        var value = message.text.replace(command, '').trim();

        return { key: command, value: value };
    },
    help: function( args, controller, bot, message ){
        bot.replyPrivate(message, {
            attachments: [
                {
                    pretext: '*/welcome help*',
                    fields: [
                        {
                            "title": "/welcome",
                            "value": "Displays the welcome message",
                            "short": false
                        },
                        {
                            "title": "/welcome edit",
                            "value": "Returns a link to edit the welcome message",
                            "short": false
                        },
                        {
                            "title": "/welcome remove",
                            "value": "Removes the welcome message",
                            "short": false
                        },
                        {
                            "title": "/welcome set [some text]",
                            "value": "Sets welcome message to the text (also creates a snippet.)",
                            "short": false
                        },
                        {
                            "title": "/welcome set:file [slack file link]",
                            "value": "Sets welcome message to the contents of the file.",
                            "short": false
                        }
                    ],
                    mrkdwn_in: ["pretext", "text", "fields"]
                }
            ]
        });
    },
    edit: function( args, controller, bot, message ){
        controller.storage.channels.get(message.channel, function(err, channel) {
            if (!channel || !channel.welcomeFileId ) {
                bot.replyPublic(message, 'Oh no! No welcome message has been setup. \n Create using `/welcome set`');
                return;
            }

            bot.api.files.info({file: channel.welcomeFileId}, function(err, res){
                if( err ){
                    bot.replyPublic(message, "Oh no! That file doesn't exist anymore!");
                } else {
                    bot.replyPrivate(message, 'Edit the welcome file at:' + res.file.permalink);
                }
            });
        });
    },
    remove: function( args, controller, bot, message ){
        controller.storage.channels.get(message.channel, function(err, channel) {
            if( !channel ){
                bot.replyPublic(message, 'Oh no! No welcome message has been setup.');
                return;
            }

            var fileId = channel.welcomeFileId;

            if( args.value ){
                var url = args.value;
                var urlParts = url.split('/');
                fileId = urlParts[ urlParts.length - 2 ];
            }

            if( !fileId ){
                bot.replyPublic(message, 'Oh no! No welcome message has been setup.');
                return;
            }

            if( fileId ){
                bot.api.files.delete({file: fileId}, function(){
                    if( err ){
                        bot.replyPublic(message, "Oh no! There was an error removing the WelcomeBot snippet!");
                        return;
                    }

                    channel.welcomeFileId = null;

                    bot.replyPublic(message, 'welcome message removed!');

                    controller.storage.channels.save(channel);
                });
            }
        });
    },
    setText: function( args, controller, bot, message ){
        var time = new Date().getTime();
        var params = {
            filename: 'welcomebot_' + time,
            title: 'Welcome!',
            content: args.value
        };

        controller.storage.channels.get(message.channel, function(err, channel) {
            if( !channel ){
                channel = {
                    id: message.channel,
                    welcomeFileId: null
                }
            }

            if( channel.welcomeFileId ){
                bot.api.files.delete({file: channel.welcomeFileId});
            }

            bot.api.files.upload(params, function(err, res){
                if( err ){
                    channel.welcomeFileId = null;
                    bot.replyPublic(message, "Oh no! There was an error creating a WelcomeBot snippet!");
                    return;
                }

                channel.welcomeFileId = res.file.id;
                bot.replyPrivate(message, "Awesome! I'll let to the team know about the updates!");
                bot.reply(message, {
                    attachments: [
                        {
                            title: 'New Welcome Message',
                            pretext: '<@' + message.user + '> updated the welcome message!',
                            text: '_Type `/welcome` to see the full message._\n\n',
                            fields: [
                                {
                                    title: 'Snippet',
                                    value: res.file.preview.trim() + '...',
                                    short: true
                                }
                            ],
                            unfurl_links: false,
                            unfurl_media: false,
                            mrkdwn_in: ["pretext", "text", "fields"],
                            color: 'good'
                        }
                    ]
                });

                controller.storage.channels.save(channel);
            });
        });
    },
    setFile: function( args, controller, bot, message ){
        var url = args.value;
        var urlParts = url.split('/');
        var fileId = urlParts[ urlParts.length - 2 ];

        bot.api.files.info({file: fileId}, function(err, res){
            if( err ){
                bot.replyPublic(message, "Oh no! That file doesn't exist!");
                return;
            }

            controller.storage.channels.get(message.channel, function(err, channel) {
                if( !channel ){
                    channel = {
                        id: message.channel,
                        welcomeFileId: null
                    }
                }

                channel.welcomeFileId = fileId;

                bot.replyPublic(message, {
                    attachments: [
                        {
                            title: 'New Welcome Message',
                            title_link: res.file.permalink,
                            fields: [
                                {
                                    title: 'Title',
                                    value: res.file.title
                                }
                            ],
                            unfurl_links: false,
                            unfurl_media: false,
                            mrkdwn_in: ["pretext", "text", "fields"],
                            color: 'good'
                        }
                    ]
                });

                controller.storage.channels.save(channel);
            });
        });
    },
    outputText: function( args, controller, bot, message ){
        controller.storage.channels.get(message.channel, function(err, channel) {
            if (!channel || !channel.welcomeFileId ) {
                bot.replyPublic(message, 'Oh no! No welcome message has been setup.');
                return;
            }

            bot.api.files.info({file: channel.welcomeFileId}, function(err, res){
                if( err ){
                    bot.replyPublic(message, "Oh no! That file doesn't exist anymore!");
                    return;
                }

                bot.replyPrivate(message, {
                    attachments: [
                        {
                            title: res.file.title,
                            title_link: res.file.permalink,
                            text: res.content,
                            color: '#000000',
                            unfurl_links: false,
                            unfurl_media: false,
                            mrkdwn_in: ["pretext", "text", "fields"]
                        }
                    ]
                });
            });
        });
    }
};

module.exports = welcomeCommand;
