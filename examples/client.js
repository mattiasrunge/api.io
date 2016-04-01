"use strict";

const api = require("api.io").client;
const co = require("co");

let run = co.wrap(function*() {
    // Connect to the API server via socket.io
    yield api.connect({
        hostname: "localhost",
        port: 8080
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
