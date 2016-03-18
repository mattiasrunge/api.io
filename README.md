# api.io
Small framework for easily exposing an API over websockets to clients

## Usage server side
```js
const api = require("api.io");

api.register("myApi", {
    sum: api.co(function*(session, a, b) {
        return a + b;
    })
});

yield api.connect(server);

api.on("connection", (client) => {
    // Do something with client
    // client.session is available
});

api.on("disconnection", (client) => {
    // Do something with client
});

yield api.disconnect();
```

## Usage client side
```js
const api = require("api.io-client");

yield api.init({
    hostname: location.hostname,
    port: location.port
});

let result = yield api.myApi(1, 2);

// result === 3
```
