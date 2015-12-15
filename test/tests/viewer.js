'use strict';
/* global Viewer, describe, it, chai */
var expect = chai.expect;
var viewer;
var mockAPIs = {
	reload: {}
};

function mockAPI(action) {
	var data = Object.create(mockAPIs[action]);
	data._action = action;
	viewer.socket.emit('echo', data);
}

describe('Connect to the server via io', function(){

	it('Should connect via sockets on /screens', function(done){

		viewer = new Viewer('http://localhost:3000');
		var i = 0;
		(function connect() {

			// wait for 200ms for server to connect
			if (!viewer.connectionState && i++ < 10) {
				return setTimeout(connect, 20);
			}
			expect(viewer.connectionState).to.be.true;
			done();
		})();
	});
});

describe('API', function () {
	it('Should reload when recieves reload', function (done) {
		viewer.on('reload', function() { done() });
		mockAPI('reload');
	});
});
