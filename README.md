# api.io
Small node.js framework for easily exposing an APIa over websockets to clients. Uses ES6 but there is a requirejs version available for use in a browser, though it still requires a modern web browser which support arrow functions, promises, generators and let.

## Tests
[![Build Status](https://travis-ci.org/mattiasrunge/api.io.png)](https://travis-ci.org/mattiasrunge/api.io)

## Usage

### Expose an API in node.js
```js
const http = require("http");
const api = require("api.io");
const co = require("co");

// Registers the api with the name myAapi
let myApi = api.register("myApi", {
    notApi: () => {
        // Only generator functions will be included in the exposed API
    },
    sum: function*(session, a, b) {
        return a + b;
    }
});

let run = co.wrap(function*() {
    // Start a HTTP server and connect the API to it
    // This will setup a socket.io connection and it will
    // not work if you try to setup your own socket.io also
    let server = http.Server();
    yield api.connect(server);
    server.listen(8080);

    // Subscribe a listener for new clients
    let connectionSubscription = api.on("connection", function*(client) {
        // Do something with client
        // client.session is available
        // Both generator functions and ordinary functions ar supported

        client.session.username = "guest";
    });

    // Subscribe a listener for lost clients
    let disconnectionSubscription = api.on("disconnection", (client) => {
        // Do something with client
        // client.session is available
        // Both generator functions and ordinary functions ar supported
    });

    // Emit event1 to all clients in the myApi namespace
    myApi.emit("event1", "Hello World!");

    // Emit event2 to client in the myApi namespace that have a session with username = "guest"
    myApi.emit("event2", "Hello World!", { username: "guest" });


    // Unsubscribe listeners from new or lost client events
    api.off(connectionSubscription);
    api.off(disconnectionSubscription);

    // Shut down the socket.io connection
    yield api.stop();

    // Close the HTTP server
    // Don't forget to close active clients (server-destroy is a good helper for this)
    server.close();
});

run();
```

### Use an API from a node.js client application
```js
const api = require("api.io").client;
const co = require("co");

let run = co.wrap(function*() {
    // Connect to the API server via socket.io
    yield api.connect({
        hostname: "localhost",
        port: 8080
    }, (status, message) => {
        if (status === "timeout") {
            console.error(message);
            process.exit(255);
        } else if (status === "disconnect") {
            console.error("Disconnected from server, will attempt to reconnect...");
        } else if (status === "reconnect") {
            console.log("Reconnected to server");
        }
    });

    // Do a function call to the myApi
    let result = yield api.myApi.sum(1, 2);
    // result === 3

    // Subscribe to myApi event1
    let subscription1 = api.myApi.on("event1", function*(data) {
        // data === "Hello World"
        // Both generator functions and ordinary functions ar supported
    });

    // Subscribe to myApi event2
    let subscription2 = api.myApi.on("event2", function(data) {
        // data === "Hello World"
        // Both generator functions and ordinary functions ar supported
    });

    // Unsubscribe from events
    api.myApi.off(subscription1);
    api.myApi.off(subscription2);
});

run();
```

### Usage client side ES6
Requires that socket.io-client and co is available via requirejs.

```js
require.config({
    baseUrl: ".",
    paths: {
        "socket.io-client": "/socket.io/socket.io",
        "api.io-client": "/api.io/api.io-client",
        "co": "/api.io/co"
    }
});

define([ "api.io-client", "co" ], (api, co) => {
    let run = co.wrap(function*() {
        // Connect to the API server via socket.io
        yield api.connect({
            hostname: location.hostname,
            port: 8080
        }, (status, message) => {
            if (status === "timeout") {
                console.error(message);
            } else if (status === "disconnect") {
                console.error("Disconnected from server, will attempt to reconnect...");
            } else if (status === "reconnect") {
                console.log("Reconnected to server");
            }
        });

        // Do a function call to the myApi
        let result = yield api.myApi.sum(1, 2);
        // result === 3

        // Subscribe to myApi event1
        let subscription1 = api.myApi.on("event1", function*(data) {
            // data === "Hello World"
            // Both generator functions and ordinary functions ar supported
        });

        // Subscribe to myApi event2
        let subscription2 = api.myApi.on("event2", function(data) {
            // data === "Hello World"
            // Both generator functions and ordinary functions ar supported
        });

        // Unsubscribe from events
        api.myApi.off(subscription1);
        api.myApi.off(subscription2);
    });

    run();
});
```
