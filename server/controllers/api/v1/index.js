var express        = require('express');
var app            = express();

var api = express.Router();

api.get('/slack/info', function(req, res) {
  res.send('Hello from APIv1 root route.');
});

api.get('/slack/welcome', function(req, res) {
  res.send('Hello from APIv1 root route.');
});

api.post('/slack/welcome/post', function(req, res) {
  res.send('post from Hello from APIv1 root route.');
});

module.exports = api;
