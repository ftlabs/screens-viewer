'use strict'
/* global io */

;
var moment = require('moment');
var EventEmitter = require('events');
var util = require('util');

var LSKEY = 'viewerData_v2';

function Viewer(host) {
	var _this = this;

	EventEmitter.call(this);

	var socket = io.connect(host + '/screens');
	var url = undefined;

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
		console.log('Received update', data.items.length, data);
		_this.update(data);
	});

	socket.on('reload', function () {
		return _this.emit('reload');
	});

	socket.on('connect', function () {
		return _this.connectionState = true;
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

	this.on('change', this.syncUp);

	console.log('Initialising socket.io...');

	var removeActiveFlag = function removeActiveFlag() {
		_this.data.items = _this.data.items.map(function (item) {
			item.active = false;
			return item;
		});
	};

	var poll = function poll() {
		var count = _this.data.items.length;
		var dirty = false;
		var date = new Date();
		date.setSeconds(0);
		date.setMilliseconds(0);

		_this.data.items = _this.data.items.filter(function (item) {
			return !item.expires || new Date(item.expires) > new Date();
		});

		if (_this.data.items < count) {
			dirty = true;
		}

		var nextItemIndex;
		var nextItem = _this.data.items.find(function (item, index) {
			nextItemIndex = index;
			return moment(item.dateTimeSchedule, 'x').isBefore(date) || moment(item.dateTimeSchedule, 'x').isSame(date);
		});

		var newUrl = nextItem ? nextItem.url : undefined;

		// Only update if the old url and new url are different
		if (!Object.is(newUrl, url)) {
			removeActiveFlag();
			if (newUrl) {
				_this.data.items[nextItemIndex].active = true;
				url = newUrl;
				_this.emit('change', url);
			} else {
				if (_this.ready()) {
					_this.emit('change', _this.getDefaultUrl());
				} else {
					_this.emit('not-connected');
				}
			}
		}
	};

	this.connectionState = false;
	this.data = JSON.parse(localStorage.getItem(LSKEY) || '{"item":[]}');

	// Every second, check whether the URL needs to be changed
	setInterval(poll.bind(this), 1000);
}
util.inherits(Viewer, EventEmitter);

module.exports = Viewer;

Viewer.prototype.update = function update(newdata) {
	this.data = newdata;

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
	console.log('Sending update', storedData.items.length, storedData);
	this.socket.emit('update', storedData);
};

Viewer.prototype.ready = function ready() {
	return this.data.id && this.connectionState;
};