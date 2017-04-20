# Screens-Viewer
[![Circle CI](https://circleci.com/gh/ftlabs/screens-viewer.svg?style=svg)](https://circleci.com/gh/ftlabs/screens-viewer)

Connects to a screens server with websockets and fires events on url change.


## Example Usage

``` js

const Viewer = require('ftlabs-screens-viewer');

// Create new viewer, give the url of the api which should be connected to.
// storageObject is a persistent storage object which has asynchronous getItem and setItem methods.
const viewer = new Viewer('https://example.com', storageObject);
viewer.start();

// The url has changed
viewer.on('change', updateFrameURL);

// A reload has been forced
viewer.on('reload', reloadFrame);

// E.g. The viewer has started but cannot connected to the server.
viewer.on('not-connected', showOfflineMessage);

```

## Developing

Dependencies go into `build/package.json` so they get installed from production.

Commands:

`npm run build` - Builds
`npm run test` - Runs tests

## Storage

The screens viewer requires a persistent storage interfaces to store information about its ID, and any items that have been pushed to it for viewing.

Whichever API you choose to use to store information, a specific interface is required for the successful operation of this module.


### The interface

The storage interface must have a `setItem` method and a `getItem` method.

**setItem**

The `setItem` method should have the following parameters:

`setItem( STORAGE_KEY:string, DATA:object, CALLBACK:function )`

- The `STORAGE_KEY` is a string that will be used to partition the data for the screen in the storage medium.

- The `DATA` object is the data to be stored. Depending on your storage interface, you may wish to convert this into a string

- The `CALLBACK` parameter will be called after the successful storage of the data. Though not strictly necessary for synchronous interfaces, it is advised that you use a callback for such operations to keep the interface uniform across multiple codebases.

**getItem**

The `getItem` method should have the following parameters:

`getItem( STORAGE_KEY:string, CALLBACK:function )`

- The `STORAGE_KEY` should be the key you used to save your data in the screens application

- The `CALLBACK` is the function you wish to have the retrieved data passed to.


### Example Storage Interface (with localStorage)

```javascript

const Viewer = require('ftlabs-screens-viewer');

const storage = {
	setItem : function(storageKey, data, callback){

		const info = localStorage.setItem(storageKey, JSON.stringify(data) );
		callback(info);

	},
	getItem : function(storageKey, callback){

		const info = localStorage.getItem(storageKey);

		if(info === null){
			callback(null);
		} else {
			callback( JSON.parse( info ) );
		}
	}
};

const viewer = new Viewer('https://example.com', storage);
viewer.start();
```