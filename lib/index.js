'use strict';
/* global io, window */

const moment = require('moment');
const EventEmitter = require('events');
const util = require('util');

const LSKEY = 'viewerData_v2';

function Viewer(host, storageOption) {
	EventEmitter.call(this);

	this.host = host;

	if(storageOption === undefined){
		throw('You must pass a storage option.');
	}

	this.dataStorage = storageOption;

	if(this.dataStorage.dataKey === undefined || this.dataStorage.dataKey === ''){
		this.dataStorage.dataKey = LSKEY;
	}

	// Returns the default url for generators, returns null if offline
	this.getDefaultUrl = function getDefaultUrl() {
		return host + '/generators/empty-screen?id=' + this.data.id;
	};

	this.getUrl = () => this.url;

	this.connectionState = false;
}

util.inherits(Viewer, EventEmitter);

Viewer.prototype.loadData = function loadData(callback) {

	this.dataStorage.getItem(this.dataStorage.dataKey, function(d){

		if (typeof d === 'string') {
			d = JSON.parse(d);
		}

		if(d === null){
			this.data = {items : []};
		} else {
			this.data = d;
		}

		callback(d);
	}.bind(this) );

}

Viewer.prototype.saveData = function saveData(data, callback) {
	this.dataStorage.setItem(this.dataStorage.dataKey, data, callback);
}

module.exports = Viewer;

Viewer.prototype.update = function update(newData) {

	const oldData = this.getData();

	this.data = newData;

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

	this.saveData(this.data, function(){
		console.log('Data saved.');
	});
};

Viewer.prototype.getData = function getData(key) {
	return key ? this.data[key] : this.data;
};

Viewer.prototype.syncUp = function syncUp() {
	const storedData = this.getData();
	this.saveData(this.data, function(){console.log('Data Saved.');});
	console.log(`Syncing Up, ${storedData.items.length} items: ${JSON.stringify(storedData, null, '  ')}`);
	this.socket.emit('update', storedData);
};

Viewer.prototype.ready = function ready() {
	return this.data.id && this.connectionState;
};

Viewer.prototype.poll = function(){

	const removeActiveFlag = () => {
		this.data.items = this.data.items.map(function (item) {
			item.active = false;
			return item;
		});
	};

	const date = new Date();
	date.setSeconds(0);
	date.setMilliseconds(0);

	this.amountOfItems = this.data.items.length;

	this.data.items = this.data.items.filter(function(item) {
		return (!item.expires || (new Date(item.expires)) > (new Date()));
	});

	const nextItem = (() => {

		for (let i=0,l = this.data.items.length; i<l; i++) {
			const item = this.data.items[i];

			if (item.dateTimeSchedule === undefined) {
				item.dateTimeSchedule = 0;
			}

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
	if (newUrl !== this.url) {
		removeActiveFlag();
		this.url = newUrl;
		if (newUrl) {
			nextItem.active = true;
			this.emit('change', this.url);
		} else {
			if (this.ready()) {
				this.emit('change', this.getDefaultUrl());
			} else {
				this.emit('not-connected');
			}
		}

		this.syncUp();
	} else if (this.amountOfItems !== this.data.items.length) {
		this.syncUp();
	}

}

Viewer.prototype.startPolling = function(){

	this.pollingInterval = setInterval(this.poll.bind(this), 1000);

}

Viewer.prototype.stopPolling = function(){
	clearInterval(this.pollingInterval);
}

Viewer.prototype.bindSocketEvents = function(){

	const socket = io.connect(this.host + '/screens');
	this.socket = socket;

	this.socket.on('requestUpdate', () => this.syncUp());

	this.socket.on('update', data => {
		console.log('Received update: ' + JSON.stringify(data, null, '  '));
		this.update(data);
	});

	this.socket.on('reload', () => this.emit('reload'));

	this.socket.on('connect', () => {
		this.connectionState = true;
		console.log('Connected');
	});

	this.socket.on('reassign', data => {

		console.log('Reassign: ' + JSON.stringify(data, null, '  '));

		const currentData = this.getData();

		if (currentData.id === data.id && currentData.idUpdated === data.idUpdated) {

			const newData = Object.assign({}, currentData);
			newData.id = data.newID;

			this.update(newData);
			this.syncUp();
		}

	});

	this.socket.on('disconnect', () => {
		this.socket.io.reconnect();
		this.connectionState = false;
	});

	this.socket.on('heartbeat', function () {
		setTimeout(function(){
			this.emit('heartbeat');
		}.bind(this), 3000);
	});

	console.log('Initialising socket.io...');

}

Viewer.prototype.start = function(){
	this.loadData(function(d){
		this.bindSocketEvents();
		this.startPolling();

		if(d === null){
			this.stateCheck = setInterval(function(){
				if(this.getData('id') !== undefined){
					window.clearTimeout(this.stateCheck);
					console.log("ID is present. Emitting `ready` event...")
					this.emit('ready', this.getDefaultUrl());
				}
			}.bind(this), 500);
		} else {
			this.emit('ready', this.getDefaultUrl());
		}

	}.bind(this));
}
