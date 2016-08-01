//  modules =================================================
var express        = require('express');
var bodyParser     = require('body-parser');
var dotenv         = require('dotenv');
var q              = require('q');

//  configuration ===========================================
//  load environment variables
dotenv.load();

//slackbot
var slackbot       = require('./server/slackbot');
var routes         = require('./server/routes/routes');

slackbot
    .connect()
    .then(function( webserver ){
        webserver.use(express.static(__dirname + '/public'));
        webserver.use(express.static(__dirname + '/public/views'));

        //port for Heroku
        webserver.set('port', (process.env.PORT));

        // routes
        routes( webserver );

        slackbot.controller.createWebhookEndpoints(webserver);
        slackbot.controller.createOauthEndpoints(webserver, function (err, req, res) {
            if (err) {
                res.status(500).send('ERROR: ' + err);
            } else {
                res.send('Success!');
            }
        });
    })
    .catch(function( err ){
        console.log('Error creating webserver', err)
    });

