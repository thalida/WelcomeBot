var welcomeCommand = {
    ALLOWED_ARGS: ['', 'help', 'edit', 'remove', 'set', 'set:file', 'set:text'],
    messages: {
        getErrorMessage: function(){
            return {
                attachments: [{
                    title: "Oh no! WelcomeBot encountered an error!",
                    text: [
                        'Please try again',
                        '_Need help? Try typing: `/welcome help`_'
                    ].join('\n'),
                    color: 'danger',
                    mrkdwn_in: ["pretext", "text", "fields"]
                }]
            };
        },
        getArgsError: function( args ){
            var errorMessage = this.getErrorMessage();
            errorMessage.color = 'warning';
            errorMessage.attachments[0].text = [
                "Oh dear, it seems I don't know how to `" + args.key + "`!",
                '_Need help? Try typing: `/welcome help`_'
            ].join('\n');
            return errorMessage;
        },
        getNoMessageError: function(){
            var errorMessage = this.getErrorMessage();
            errorMessage.attachments[0].title = "Oh no! There's no welcome message!";
            errorMessage.attachments[0].text = [
                'Create one using `/welcome set`.',
                '_Need help? Try typing: `/welcome help`_'
            ].join('\n');

            return errorMessage;
        },
        getNoFileError: function(){
            var errorMessage = this.getErrorMessage();
            errorMessage.attachments[0].title = "Oh no! There's no welcome message file!";
            errorMessage.attachments[0].text = [
                'Create one using `/welcome set`.',
                '_Need help? Try typing: `/welcome help`_'
            ].join('\n');

            return errorMessage;
        },
        getMessageRemoveError: function(){
            var errorMessage = this.getErrorMessage();
            errorMessage.attachments[0].text = [
                "There was an error removing the message.",
                'Please try again',
                '_Need help? Try typing: `/welcome help`_'
            ].join('\n');

            return errorMessage;
        },
        getMessageSuccess: function( res ){
            return {
                attachments: [{
                    title: res.file.title,
                    title_link: res.file.permalink,
                    text: res.content || res.content_html,
                    color: '#000000',
                    unfurl_links: false,
                    unfurl_media: false,
                    mrkdwn_in: ["pretext", "text", "fields"]
                }]
            };
        },
        getCreatePrivateSuccess: function(){
            return "Awesome! I'll let to the team know about the updates!";
        },
        getCreatePublicSuccess: function( res, message ){
            return {
                attachments: [
                    {
                        pretext: '<@' + message.user + '> updated the welcome message! \n_Type `/welcome` to see the full message._\n',
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
            };
        },
        getMessageEditSuccess: function( res ){
            return 'Edit the welcome file at: \n' + res.file.edit_link
        },
        getMessageRemoveSuccess: function( res ){
            return "You've removed the welcome message!"
        }
    },
    run: function( controller, bot, message ){
        var args = this.processArgs( message );

        if(this.ALLOWED_ARGS.indexOf(args.key) === -1 ){
            bot.replyPublic(message, this.messages.getArgsError( args ));
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

        argFunc.call( this, args, controller, bot, message );
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
                    pretext: '*WelcomeBot Help*',
                    fields: [
                        {
                            "title": "/welcome",
                            "value": "Displays the welcome message",
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
                        }
                    ],
                    mrkdwn_in: ["pretext", "text", "fields"]
                }
            ]
        });
    },
    outputText: function( args, controller, bot, message ){
        var self = this;

        controller.storage.channels.get(message.channel, function(err, channel) {
            if (!channel || !channel.welcomeFileId ) {
                bot.replyPublic(message, self.messages.getNoMessageError());
                return;
            }

            bot.api.files.info({file: channel.welcomeFileId}, function(err, res){
                if( err ){
                    bot.replyPublic(message, self.messages.getNoFileError());
                    return;
                }

                bot.replyPrivate(message, self.messages.getMessageSuccess( res ));
            });
        });
    },
    setText: function( args, controller, bot, message ){
        var self = this;

        var time = new Date().getTime();
        var params = {
            filename: 'welcomebot_' + time,
            filetype: 'text',
            title: 'Welcome!',
            content: args.value,
            channels: message.channel
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
                    bot.replyPublic(message, self.messages.getErrorMessage());
                    return;
                }

                channel.welcomeFileId = res.file.id;

                bot.replyPrivate(message, self.messages.getCreatePrivateSuccess());
                bot.reply(message, self.messages.getCreatePublicSuccess( res, message ));

                controller.storage.channels.save(channel);
            });
        });
    },
    setFile: function( args, controller, bot, message ){
        var self = this;
        var url = args.value;
        var urlParts = url.split('/');
        var fileId = urlParts[ urlParts.length - 2 ];

        bot.api.files.info({file: fileId}, function(err, res){
            if( err ){
                 bot.replyPublic(message, self.messages.getNoFileError());
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

                bot.replyPrivate(message, self.messages.getCreatePrivateSuccess());
                bot.reply(message, self.messages.getCreatePublicSuccess( res, message ));

                controller.storage.channels.save(channel);
            });
        });
    },
    edit: function( args, controller, bot, message ){
        var self = this;

        controller.storage.channels.get(message.channel, function(err, channel) {
            if (!channel || !channel.welcomeFileId ) {
                bot.replyPublic(message, self.messages.getNoMessageError());
                return;
            }

            bot.api.files.info({file: channel.welcomeFileId}, function(err, res){
                if( err ){
                    bot.replyPublic(message, self.messages.getNoFileError());
                } else {
                    bot.replyPrivate(message, self.messages.getMessageEditSuccess( res ));
                }
            });
        });
    },
    remove: function( args, controller, bot, message ){
        var self = this;

        controller.storage.channels.get(message.channel, function(err, channel) {
            if( !channel ){
                bot.replyPublic(message, self.messages.getNoMessageError());
                return;
            }

            var fileId = channel.welcomeFileId;

            if( args.value ){
                var url = args.value;
                var urlParts = url.split('/');
                fileId = urlParts[ urlParts.length - 2 ];
            }

            if( !fileId ){
                bot.replyPublic(message, self.messages.getNoMessageError());
                return;
            }

            if( fileId ){
                bot.api.files.delete({file: fileId}, function(){
                    if( err ){
                        bot.replyPublic(message, self.messages.getMessageRemoveError());
                        return;
                    }

                    channel.welcomeFileId = null;

                    bot.replyPublic(message, self.messages.getMessageRemoveSuccess());

                    controller.storage.channels.save(channel);
                });
            }
        });
    }
};

module.exports = welcomeCommand;
