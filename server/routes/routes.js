var Request          = require('request');

module.exports = function( app ) {
    //public pages=============================================
    app.get('/', function(req, res) {
        console.log("index")
        res.sendFile('index.html');
    });
}
