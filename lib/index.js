'use strict';
/* global io */

require("babel-polyfill");
const moment = require('moment');
const EventEmitter = require('events');
const util = require('util');

const LSKEY = 'viewerData_v2';

function Viewer(host) {
	EventEmitter.call(this);

	const socket = io.connect(host + '/screens');
	let url;

	// Returns the default url for generators, returns null if offline
	this.getDefaultUrl = function getDefaultUrl() {
		return host + '/generators/empty-screen?id=' + this.data.id;
	};

	this.getUrl = () => url;

	this.socket = socket;

	socket.on('requestUpdate', () => this.syncUp());

	socket.on('update', data => {
		console.log('Received update', data);
		this.update(data);
	});

	socket.on('reload', () => this.emit('reload'));

	socket.on('connect', () => this.connectionState = true );

	socket.on('disconnect', () => {
		socket.io.reconnect();
		this.connectionState = false;
	});

	socket.on('heartbeat', function () {
		setTimeout(function () {
			socket.emit('heartbeat');
		}, 3000);
	});

	console.log('Initialising socket.io...');

	const removeActiveFlag = () => {
		this.data.items = this.data.items.map(function (item) {
			item.active = false;
			return item;
		});
	};

	const poll = () => {
		const count = this.data.items.length;
		var dirty = false;
		const date = new Date();
		date.setSeconds(0);
		date.setMilliseconds(0);

		this.data.items = this.data.items.filter(function(item) {
			return (!item.expires || (new Date(item.expires)) > (new Date()));
		});

		if (this.data.items < count) {
			dirty = true;
		}

		var nextItemIndex;
		const nextItem = this.data.items.find(function (item, index) {
			nextItemIndex = index;
			return moment(item.dateTimeSchedule, 'x').isBefore(date) ||
				moment(item.dateTimeSchedule, 'x').isSame(date);
		});

		const newUrl = nextItem ? nextItem.url : undefined;

		// Only update if the old url and new url are different
		if (!(Object.is(newUrl, url))) {
			removeActiveFlag();
			url = newUrl;
			if (newUrl) {
				this.data.items[nextItemIndex].active = true;
				this.emit('change', url);
			} else {
				if (this.ready()) {
					this.emit('change', this.getDefaultUrl());
				} else {
					this.emit('not-connected');
				}
			}
			this.syncUp();
		}
	};

	this.connectionState = false;
	this.data = JSON.parse(localStorage.getItem(LSKEY) || '{"items":[]}');

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
