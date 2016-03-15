'use strict';
/* global io, localStorage */

var moment = require('moment');
var EventEmitter = require('events');
var util = require('util');

var LSKEY = 'viewerData_v2';

function Viewer(host) {
	var _this = this;

	EventEmitter.call(this);

	var socket = io.connect(host + '/screens');
	var url = void 0;

	// Returns the default url for generators, returns null if offline
	this.getDefaultUrl = function getDefaultUrl() {
		return host + '/generators/empty-screen?id=' + this.data.id;
	};

	this.getUrl = function () {
		return url;
	};

	this.socket = socket;

	socket.on('requestUpdate', function () {
		return _this.syncUp();
	});

	socket.on('update', function (data) {
		console.log('Received update: ' + JSON.stringify(data, null, '  '));
		_this.update(data);
	});

	socket.on('reload', function () {
		return _this.emit('reload');
	});

	socket.on('connect', function () {
		return _this.connectionState = true;
	});

	socket.on('reassign', function (data) {

		console.log('Reassign: ' + JSON.stringify(data, null, '  '));

		var currentData = _this.getData();

		if (currentData.id === data.id && currentData.idUpdated === data.idUpdated) {

			var newData = Object.assign({}, currentData);
			newData.id = data.newID;

			_this.update(newData);
			_this.syncUp();
		}
	});

	socket.on('disconnect', function () {
		socket.io.reconnect();
		_this.connectionState = false;
	});

	socket.on('heartbeat', function () {
		setTimeout(function () {
			socket.emit('heartbeat');
		}, 3000);
	});

	console.log('Initialising socket.io...');

	var removeActiveFlag = function removeActiveFlag() {
		_this.data.items = _this.data.items.map(function (item) {
			item.active = false;
			return item;
		});
	};

	var poll = function poll() {

		var date = new Date();
		date.setSeconds(0);
		date.setMilliseconds(0);

		var amountOfItems = _this.data.items.length;

		_this.data.items = _this.data.items.filter(function (item) {
			return !item.expires || new Date(item.expires) > new Date();
		});

		var nextItem = function () {

			for (var i = 0, l = _this.data.items.length; i < l; i++) {
				var item = _this.data.items[i];

				if (moment(item.dateTimeSchedule, 'x').isBefore(date) || moment(item.dateTimeSchedule, 'x').isSame(date)) {
					return item;
				}
			}
		}();

		var newUrl = nextItem ? nextItem.url : undefined;

		// Only update if the old url and new url are different
		if (newUrl !== url) {
			removeActiveFlag();
			url = newUrl;
			if (newUrl) {
				nextItem.active = true;
				_this.emit('change', url);
			} else {
				if (_this.ready()) {
					_this.emit('change', _this.getDefaultUrl());
				} else {
					_this.emit('not-connected');
				}
			}
		}

		if (amountOfItems !== _this.data.items.length) {
			_this.syncUp();
		}
	};

	this.connectionState = false;
	this.data = JSON.parse(localStorage.getItem(LSKEY) || '{"items":[]}');

	// Every second, check whether the URL needs to be changed
	setInterval(poll.bind(this), 1000);
}
util.inherits(Viewer, EventEmitter);

module.exports = Viewer;

Viewer.prototype.update = function update(newData) {

	var oldData = this.getData();

	this.data = newData;

	if (!oldData.idUpdated && !newData.idUpdated) {
		newData.idUpdated = Date.now();
		this.syncUp();
	}

	// If ID of this screen has changed, update the UI
	if (newData.id && newData.id !== oldData.id) {
		newData.idUpdated = Date.now();
		this.emit('id-change');

		// if it is currently displaying the default url update the id
		if (!this.getUrl()) {
			this.emit('change', this.getDefaultUrl());
		}
	}

	if (!('items' in this.data)) {
		this.data = this.data.items = [];
	}

	this.data.items = this.data.items.sort(function (a, b) {
		return moment(a.dateTimeSchedule, 'x').isBefore(moment(b.dateTimeSchedule, 'x'));
	});

	localStorage.setItem(LSKEY, JSON.stringify(this.data));
};

Viewer.prototype.getData = function getData(key) {
	return key ? this.data[key] : this.data;
};

Viewer.prototype.syncUp = function syncUp() {
	var storedData = this.getData();
	console.log('Syncing Up, ' + storedData.items.length + ' items: ' + JSON.stringify(storedData, null, '  '));
	this.socket.emit('update', storedData);
};

Viewer.prototype.ready = function ready() {
	return this.data.id && this.connectionState;
};