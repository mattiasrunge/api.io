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

    // Subscribe to myApi event3 but only for values => 4
    // using a MongoDB style query. The query is evaluated using
    // [sift](https://www.npmjs.com/package/sift).
    // Note that when using queries, an id unique per query for
    // the specific event needs to be supplied as well.
    const subscription3 = api.myApi.on("event3", (data) => {
        // Triggered twice, first with data === { value: 4 }
        // then with data === { value: 5 }
        // Both async functions and ordinary functions are supported
    }, {
        id: 1,
        query: { $gte: 4 }
    });

    // Unsubscribe from events
    api.myApi.off(subscription1);
    api.myApi.off(subscription2);
    api.myApi.off(subscription3);
};

run();
