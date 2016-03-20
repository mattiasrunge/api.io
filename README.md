# api.io
Small framework for easily exposing an API over websockets to clients. Requires a modern web browser and nodejs which support arrow functions, promises, generators and let.

## Usage server side
```js
const api = require("api.io");

let myApi = api.register("myApi", {
    notApi: function() {
        // Only generator functions will be included in
        // the exposed API
    },
    sum: function*(session, a, b) {
        return a + b;
    }
});

yield api.connect(server);

myApi.emit("event", "Hello World!");

myApi.emit("event", "Hello World!", { username: "guest" });

let connectionSubscription = api.on("connection", function*(client) => {
    // Do something with client
    // client.session is available
    // Both generator functions and ordinary functions ar supported

    client.session.username = "guest";
});

let disconnectionSubscription = api.on("disconnection", (client) => {
    // Do something with client
    // client.session is available
    // Both generator functions and ordinary functions ar supported
});

api.off(connectionSubscription);
api.off(disconnectionSubscription);

yield api.disconnect();
```

## Usage client side ES6
Requires that socket.io-client is available via requirejs.

```js
const api = require("api.io-client");

yield api.init({
    hostname: location.hostname,
    port: location.port
});

let result = yield api.myApi.sum(1, 2);
// result === 3

let subscription1 = api.myApi.on("event", function*(data) {
    // data === "Hello World"
    // Both generator functions and ordinary functions ar supported
});

let subscription2 = api.myApi.on("event", function(data) {
    // data === "Hello World"
    // Both generator functions and ordinary functions ar supported
});


api.myApi.off(subscription1);
api.myApi.off(subscription2);
```
