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
        getMessageSuccess: function( res, author ){
            var message = {
                title: res.file.title,
                title_link: res.file.permalink,
                text: res.content || res.content_html,
                footer: 'WelcomeBot',
                color: '#000000',
                unfurl_links: false,
                unfurl_media: false,
                mrkdwn_in: ["pretext", "text", "fields"]
            };

            if( author ){
                message.author_name = author.real_name + ' (@' + author.name + ')';
                message.author_icon = author.profile.image_48;
            }

            return { attachments: [ message ] };
        },
        getCreatePrivateSuccess: function(){
            return "Awesome! I'll let to the team know about the updates!";
        },
        getCreatePublicSuccess: function( res, message ){
            return {
                attachments: [
                    {
                        pretext: [
                            '<@' + message.user + '> updated the welcome message!',
                            '_Type `/welcome` to see the full message._\n'
                        ].join('\n'),
                        fields: [
                            {
                                title: 'Snippet',
                                value: res.file.preview.trim() + '...'
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
        getMessageEditSuccess: function( res, author ){
            var message = {
                title: 'Edit Welcome Message',
                text: [
                    'Use the following link to update the message:',
                    res.file.edit_link
                ].join('\n'),
                footer: 'WelcomeBot',
                color: 'good',
                unfurl_links: false,
                unfurl_media: false,
                mrkdwn_in: ["pretext", "text", "fields"]
            };

            if( author ){
                message.author_name = author.real_name + ' (@' + author.name + ')';
                message.author_icon = author.profile.image_48;
            }

            return { attachments: [ message ] };
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
            if (!channel || !channel.welcomeFile || !channel.welcomeFile.fileId ) {
                bot.replyPublic(message, self.messages.getNoMessageError());
                return;
            }

            bot.api.files.info({file: channel.welcomeFile.fileId}, function(err, fileRes){
                if( err ){
                    bot.replyPublic(message, self.messages.getNoFileError());
                    return;
                }

                bot.api.users.info({user: channel.welcomeFile.createdBy}, function( err, userRes ){
                    var user = ( err ) ? null : userRes.user;
                    bot.replyPrivate(message, self.messages.getMessageSuccess( fileRes, user ));
                });
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
            if( !channel || !channel.welcomeFile ){
                channel = {
                    id: message.channel,
                    welcomeFile: {
                        fileId: null,
                        createdBy: null,
                        triggeredByBot: true
                    }
                }
            }

            if( channel.welcomeFile.fileId && channel.welcomeFile.triggeredByBot ){
                bot.api.files.delete({file: channel.welcomeFile.fileId});
            }

            bot.api.files.upload(params, function(err, res){
                if( err ){
                    channel.welcomeFile = null;
                    bot.replyPublic(message, self.messages.getErrorMessage());
                    return;
                }

                channel.welcomeFile = {
                    fileId: res.file.id,
                    createdBy: message.user,
                    triggeredByBot: true
                };

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
                        welcomeFile: {
                            fileId: null,
                            createdBy: null,
                            triggeredByBot: false
                        }
                    }
                }

                channel.welcomeFile = {
                    fileId: fileId,
                    createdBy: message.user
                };

                bot.replyPrivate(message, self.messages.getCreatePrivateSuccess());
                bot.reply(message, self.messages.getCreatePublicSuccess( res, message ));

                controller.storage.channels.save(channel);
            });
        });
    },
    edit: function( args, controller, bot, message ){
        var self = this;

        controller.storage.channels.get(message.channel, function(err, channel) {
            if (!channel || !channel.welcomeFile || !channel.welcomeFile.fileId ) {
                bot.replyPublic(message, self.messages.getNoMessageError());
                return;
            }

            bot.api.files.info({file: channel.welcomeFile.fileId}, function(err, fileRes){
                if( err ){
                    bot.replyPublic(message, self.messages.getNoFileError());
                } else {
                    bot.api.users.info({user: channel.welcomeFile.createdBy}, function( err, userRes ){
                        var user = ( err ) ? null : userRes.user;
                        bot.replyPrivate(message, self.messages.getMessageEditSuccess( fileRes, user ));
                    });
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

            var fileId = (channel.welcomeFile) ? channel.welcomeFile.fileId : null;

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

                    channel.welcomeFile = null;

                    bot.replyPublic(message, self.messages.getMessageRemoveSuccess());

                    controller.storage.channels.save(channel);
                });
            }
        });
    }
};

module.exports = welcomeCommand;
