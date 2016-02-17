var http = require('http');
var express = require('express');
var app = express();
var controllers = require("./controllers");

app.set("view engine", "vash");

//set the public static resource folder
app.use(express.static(__dirname + "/public"));

controllers.init(app);

var server = http.createServer(app);

server.listen(process.env.PORT || 1234, function(){
  console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});
