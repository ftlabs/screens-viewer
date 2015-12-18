'use strict';
/* global io */

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

	socket.on('reassign', data => {

		console.log("Reassign", data);

		const currentData = this.getData();

		if (currentData.id === data.id && currentData.idUpdated === data.idUpdated) {

			const newData = Object.assign({}, currentData);
			newData.id = data.newID;
			
			this.update(newData);
			this.syncUp();
		}

	});


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


		const nextItem = (() => {

			for (let i=0,l = this.data.items.length; i<l; i++) {
				const item = this.data.items[i];

				if (
					moment(item.dateTimeSchedule, 'x').isBefore(date) ||
					moment(item.dateTimeSchedule, 'x').isSame(date)
				) {
					return item;
				}
			}
		})();

		const newUrl = nextItem ? nextItem.url : undefined;

		// Only update if the old url and new url are different
		if (newUrl !== url) {
			removeActiveFlag();
			url = newUrl;
			if (newUrl) {
				nextItem.active = true;
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

	const olddata = this.getData();

	if(!olddata.idUpdated && !newdata.idUpdated){
		newdata.idUpdated = Date.now();
		this.syncUp();
	}

	this.data = newdata;

	// If ID of this screen has changed, update the UI
	if (newdata.id && newdata.id !== olddata.id) {
		newdata.idUpdated = Date.now();
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
	console.log('Sending update', storedData.items.length, storedData);
	this.socket.emit('update', storedData);
};

Viewer.prototype.ready = function ready() {
	return this.data.id && this.connectionState;
};
