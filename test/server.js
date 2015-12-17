'use strict';

const express = require('express');
const app = express();
const http = require('http');

const server = http.createServer(app);
const ioServer = require('socket.io').listen(server).of('/screens');

ioServer.on('connection', function(socket) {

	// when a request is recieved echo it back
	socket.on('echo', function (data) {
		const action = data._action;
		delete data._action;
		socket.emit(action, data);
	});
});

app.use(express.static(__dirname));

server.listen(3000);
