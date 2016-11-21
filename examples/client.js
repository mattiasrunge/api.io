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
