'use strict';

var express = require('express');
var app = express();
var http = require('http');

var server = http.createServer(app);
var ioServer = require('socket.io').listen(server).of('/screens');

ioServer.on('connection', function (socket) {

	// when a request is recieved echo it back
	socket.on('echo', function (data) {
		var action = data._action;
		delete data._action;
		socket.emit(action, data);
	});
});

app.use(express.static(__dirname));

server.listen(3000);