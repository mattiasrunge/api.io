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

module.exports = {
    run: run,
    stop: stop
};
