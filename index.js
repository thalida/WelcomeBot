// modules =================================================
var express        = require('express');
var app            = express();
var bodyParser     = require('body-parser');
var http           = require('http').Server(app);
var dotenv         = require('dotenv');

// configuration ===========================================

//load environment variables,
//either from .env files (development),
//heroku environment in production, etc...
dotenv.load();

// public folder for images, css,...
app.use(express.static(__dirname + '/public'));
app.set('views', __dirname + '/public/views');
// app.use(express.static(__dirname + '/public/views'));

//parsing
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); //for parsing url encoded

app.set('view engine', 'ejs');

// routes
require('./server/routes/routes')(app);

// apis
app.use('/api/v1', require('./server/controllers/api/v1/index.js'));

//port for Heroku
app.set('port', (process.env.PORT));

//botkit (apres port)
require('./server/controllers/botkit')

//START ===================================================
http.listen(app.get('port'), function(){
  console.log('listening on port ' + app.get('port'));
});

