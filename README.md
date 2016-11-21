# api.io
Small node.js framework for easily exposing an APIa over websockets to clients. Uses ES6 but there is a requirejs version available for use in a browser, though it still requires a modern web browser which support arrow functions, promises, generators and let.

## Tests
[![Build Status](https://travis-ci.org/mattiasrunge/api.io.png)](https://travis-ci.org/mattiasrunge/api.io)

## Usage

### Expose an API in node.js
```js
"use strict";

const http = require("http");
const api = require("../api.io");

// Registers the api with the name myApi
const myApi = api.register("myApi", {
    VALUE: "const",
    notApi: () => {
        // Only exported functions will be included in the exposed API
    },
    sum: api.export((session, a, b) => {
        // Exported function included in the exposed API
        return a + b;
    }),
    sumAsync: api.export(async (session, a, b) => {
        // Exported async function included in the exposed API
        return a + b;
    }),
    send: api.export((session) => {
        // Exported function included in the exposed API
        myApi.emit("event3", "ABC");
    })
});

// Registers the api with the name myApi2
const myApi2 = api.register("myApi2", {
    send: api.export(async (session) => {
        // Exported generator function included in the exposed API
        myApi2.emit("eventX", "Over myApi2");
    })
});

let connectionSubscription;
let disconnectionSubscription;
let server;

const run = async (port) => {
    // Start a HTTP server and connect the API to it
    // This will setup a socket.io connection and it will
    // not work if you try to setup your own socket.io also
    server = new http.Server();
    await api.start(server);
    server.listen(port);

    // Subscribe a listener for new clients
    connectionSubscription = api.on("connection", async (client) => {
        // Do something with client
        // client.session is available
        // Both generator functions and ordinary functions are supported

        client.session.username = "guest";
    });

    // Subscribe a listener for lost clients
    disconnectionSubscription = api.on("disconnection", (client) => {
        // Do something with client
        // client.session is available
        // Both generator functions and ordinary functions are supported
    });

    // Emit event1 to all clients in the myApi namespace
    myApi.emit("event1", "Hello World!");

    // Emit event2 to client in the myApi namespace that have a session with username = "guest"
    myApi.emit("event2", "Hello World!", { username: "guest" });
};

const stop = async () => {
    // Unsubscribe listeners from new or lost client events
    api.off(connectionSubscription);
    api.off(disconnectionSubscription);

    // Shut down the socket.io connection
    await api.stop();

    // Close the HTTP server
    // Don't forget to close active clients (server-destroy is a good helper for this)
    server.close();
};

run();

// stop(); When exiting the application

```

### Use an API from a node.js client application
```js
"use strict";

const api = require("api.io").client;

const run = async () => {
    // Connect to the API server via socket.io
    await api.connect({
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

    console.log(api.myApi.CONST_VALUE);
    // => 1

    // Do a function call to a myApi server-side function
    const result = await api.myApi.sum(1, 2);
    // result === 3

    // Do a function call to a myApi server-side async function
    const result2 = await api.myApi.sumAsync(1, 3);
    // result2 === 4

    // Subscribe to myApi event1
    const subscription1 = api.myApi.on("event1", async (data) => {
        // data === "Hello World"
        // Both async functions and ordinary functions are supported
    });

    // Subscribe to myApi event2
    const subscription2 = api.myApi.on("event2", (data) => {
        // data === "Hello World"
        // Both async functions and ordinary functions are supported
    });

    // Unsubscribe from events
    api.myApi.off(subscription1);
    api.myApi.off(subscription2);
};

run();
```

### Usage client side ES6
Requires that socket.io-client and co is available via requirejs.

```js
require.config({
    baseUrl: ".",
    paths: {
        "socket.io-client": "/socket.io/socket.io",
        "api.io-client": "/api.io/api.io-client"
    }
});

define([ "api.io-client", "co" ], (api, co) => {
    "use strict";

    const api = require("api.io").client;

    const run = async () => {
        // Connect to the API server via socket.io
        await api.connect({
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

        console.log(api.myApi.CONST_VALUE);
        // => 1

        // Do a function call to a myApi server-side function
        const result = await api.myApi.sum(1, 2);
        // result === 3

        // Do a function call to a myApi server-side async function
        const result2 = await api.myApi.sumAsync(1, 3);
        // result2 === 4

        // Subscribe to myApi event1
        const subscription1 = api.myApi.on("event1", async (data) => {
            // data === "Hello World"
            // Both async functions and ordinary functions are supported
        });

        // Subscribe to myApi event2
        const subscription2 = api.myApi.on("event2", (data) => {
            // data === "Hello World"
            // Both async functions and ordinary functions are supported
        });

        // Unsubscribe from events
        api.myApi.off(subscription1);
        api.myApi.off(subscription2);
    };

    run();
});
```
