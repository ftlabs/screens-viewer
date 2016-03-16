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
			{url: 'https://ada.is'}
		]
	},
	updateUrlExpires: {
		_action: 'update',
		id: 12345,
		name: 'Dummy Test Viewer',
		items: [
			{
				url: 'https://ft.com',
				expires: 0 // will be filled in later
			}
		]
	},
	assignId: {
		_action: 'reassign',
		newID: 12346,
		id: 12345
	},
	updateUrlSchedule: {
		_action: 'update',
		id: 12346,
		name: 'Dummy Test Viewer',
		items: [
			{
				url: 'https://google.com',
				dateTimeSchedule: 0 // will be filled in later
			}
		]
	},
	updateUrlDuplicate: {
		_action: 'update',
		id: 12346,
		name: 'Dummy Test Viewer',
		items: [
			{url: 'https://twitter.com'}
		]
	}
};

function mockAPI(action) {
	viewer.socket.emit('echo', mockAPIs[action]);
}

describe('Connect to the server via io', function(){

	localStorage.setItem('viewerData_v2', JSON.stringify(mockAPIs.updateId));
	viewer = new Viewer('http://localhost:3000');

	it('Should connect via sockets on /screens', function(done){
		viewer.socket.on('connect', function () {
			expect(viewer.connectionState).to.be.true;
			expect(viewer.data).to.not.be.undefined;
			done();
		});
	});

	it('Should set the saved data correctly', function(done){
		expect(viewer.getData('name')).to.equal('Dummy Test Viewer');
		expect(viewer.getData('id')).to.equal(12345);
		done();
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

	it('Should not update when nothing updated', function (done) {
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
			expect(url).to.equal('https://ada.is');
			done();
		});
	});

	it('Should change the urls which expire.', function (done) {
		this.timeout(3000);
		mockAPIs.updateUrlExpires.items[0].expires = Date.now() + 1000;
		mockAPI('updateUrlExpires');
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

	it('Should be able to have id reassigned.', function (done) {

		viewer.once('id-change', function () {
			expect(viewer.getData('id')).to.equal(12346);
			done();
		});

		mockAPIs.assignId.idUpdated = viewer.getData('idUpdated');
		mockAPI('assignId');
	});

	it('Should not refresh the page if the url did not change', function (done) {
		viewer.once('change', function () {
			throw Error('change was fired even though url did not change.');
		});
		viewer.socket.once('update', function () {

			mockAPI('updateUrlDuplicate');
			viewer.socket.once('update', function () {

				// Make sure no change has happened after an update has been recieved.
				setTimeout(done, 200);
			});
		});
		mockAPI('updateUrlDuplicate');
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

		viewer.once('change', function (url) {
			expect(url).to.equal('https://google.com');
			if (Date.now() > mockAPIs.updateUrlSchedule.items[0].dateTimeSchedule) {
				done();
			} else {
				throw Error('Updated too soon.');
			}
		});

		mockAPIs.updateUrlSchedule.items[0].dateTimeSchedule = scheduleTime;
		mockAPI('updateUrlSchedule');
	});
});
