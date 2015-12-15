'use strict';

const ioServer = require('socket.io')().of('/screens');
ioServer.on('connection', function(socket) {
	console.log(socket);
});
