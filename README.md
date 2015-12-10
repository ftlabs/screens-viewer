# screens-viewer

Connects to a screens server with websockets and fires events on url change.

## Example Usage

```
	// Create new viewer, give the url of the api which should be connected to.
	const viewer = new Viewer('https://ftlabs-screens.herokuapp.com');

  // The url has changed
	viewer.on('change', updateFrameURL);

  // A reload has been forced
	viewer.on('reload', reloadFrame);

  // E.g. The viewer has started but cannot connected to the server.
	viewer.on('not-connected', showOfflineMessage);

```
