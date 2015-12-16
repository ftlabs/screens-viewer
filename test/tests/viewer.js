'use strict';
/* global Viewer, describe, it, chai, afterEach */
var expect = chai.expect;
var viewer;
var mockAPIs = {
	reload: {
		_action: 'reload'
	},
	updateId: {
		_action: 'update',
		id: 12345,
		name: 'Dummy Test Viewer',
		items: []
	},
	updateUrl: {
		_action: 'update',
		id: 12345,
		name: 'Dummy Test Viewer',
		items: [
			{url: 'https://google.com'}
		]
	}
};

function mockAPI(action) {
	viewer.socket.emit('echo', mockAPIs[action]);
}

describe('Connect to the server via io', function(){

	it('Should connect via sockets on /screens', function(done){

		viewer = new Viewer('http://localhost:3000');
		viewer.socket.on('connect', function () {
			expect(viewer.connectionState).to.be.true;
			expect(viewer.data).to.not.be.undefined;
			done();
		});
	});
});

describe('API', function () {

	// remove all listeners
	afterEach(function() {
		viewer.removeAllListeners('change');
		viewer.removeAllListeners('update');
		viewer.removeAllListeners('reload');
	});

	it('Should reload when recieves reload', function (done) {
		viewer.once('reload', function() { done() });
		mockAPI('reload');
	});

	it('Should not update when only id updated', function (done) {
		function err() { throw Error('Should not change, no items added.') }
		viewer.once('change', err);
		mockAPI('updateId');
		viewer.socket.once('update', function () {
			setTimeout(function() {
				viewer.removeListener('change', err);
				done();
			}, 200);
		});
	});

	it('Should update when the url list is updated', function (done) {
		mockAPI('updateUrl');
		viewer.once('change', function (url) {
			expect(url).to.equal('https://google.com');
			done();
		});
	});

	it('Should change the urls which expire.', function (done) {

		// it needs a smidge more time
		this.timeout(2500);

		mockAPIs.updateUrl.items[0].expires = Date.now() + 1000;
		mockAPIs.updateUrl.items[0].url = 'https://ft.com';
		mockAPI('updateUrl');
		viewer.once('change', function (url) {
			expect(url).to.equal('https://ft.com');
			viewer.once('change', function (url) {

				// Expect it to show the empty-screen page since there are no others
				expect(url).to.match(/\/generators\/empty-screen\?id=12345$/);

				// GetUrl should be undefined because the current page as sent by the server is undefined
				expect(viewer.getUrl()).to.be.undefined;
				done();
			});
		});
	});

	it('Should show scheduled pages at the correct time.', function (done) {

		// this will take at most one minute as it succeeds when the clock ticks over
		this.timeout(61000);

		// schedule it for the next time a minute happens
		// since the that is how the schedules are set on the admin page
		// and the viewer rolls down the current time to the nearest minute
		var scheduleTime = new Date();
		scheduleTime.setSeconds(0);
		scheduleTime.setMilliseconds(0);
		scheduleTime = scheduleTime.getTime() + 60000;

		delete mockAPIs.updateUrl.items[0].expires;
		mockAPIs.updateUrl.items[0].dateTimeSchedule = scheduleTime;
		mockAPIs.updateUrl.items[0].url = 'https://google.com';
		viewer.once('change', function (url) {
			expect(url).to.equal('https://google.com');
			if (Date.now() > mockAPIs.updateUrl.items[0].dateTimeSchedule) {
				done();
			} else {
				throw Error('Updated too soon.');
			}
		});
		mockAPI('updateUrl');
	});

	it('Should not refresh the page if the url did not change', function (done) {
		delete mockAPIs.updateUrl.items[0].dateTimeSchedule;
		viewer.once('change', function () {
			throw Error('change was fired even though url did not change.');
		});
		viewer.socket.on('update', function () {

			// Make sure no change has happened after an update has been recieved.
			setTimeout(done, 200);
		});
		mockAPI('updateUrl');
		done();
	});
});
