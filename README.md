# Screens-Viewer
[![Circle CI](https://circleci.com/gh/ftlabs/screens-viewer.svg?style=svg)](https://circleci.com/gh/ftlabs/screens-viewer)

Connects to a screens server with websockets and fires events on url change.


## Example Usage

``` js

const Viewer = require('ftlabs-screens-viewer');

// Create new viewer, give the url of the api which should be connected to.
// storageObject is a persistend storage object has asynchronous getItem and setItem methods.
const viewer = new Viewer('https://example.com', storageObject);
viewer.start();

// The url has changed
viewer.on('change', updateFrameURL);

// A reload has been forced
viewer.on('reload', reloadFrame);

// E.g. The viewer has started but cannot connected to the server.
viewer.on('not-connected', showOfflineMessage);

```

# Developing

Dependencies go into `build/package.json` so they get installed from production.

Commands:

`npm run build` - Builds
`npm run test` - Runs tests
