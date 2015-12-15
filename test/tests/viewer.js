'use strict';
/* global Viewer, describe, it */

describe('Connect to the server via io', function(){

	it('Should connect via sockets on /screens', function(done){

		var viewer = new Viewer('http://localhost');
		console.log(viewer.data);
		done();
	});
});
