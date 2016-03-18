define(["module", "socket.io-client", "bluebird"], function (module, socket, Bluebird) {
    "use strict";

    const co = Bluebird.coroutine;

    let io = null;
    let params = {};
    let connected = false;

    module.exports = {
        connect: co(function* (config) {
            params = config;

            yield module.exports._connect();

            let api = yield module.exports._call("api", {});

            for (let namespace of Object.keys(api)) {
                module.exports[namespace] = {};

                for (let method of Object.keys(api[namespace])) {
                    module.exports[namespace][method] = function () {
                        let name = namespace + "." + method;
                        let args = Array.from(arguments);
                        let data = {};

                        for (let name of api[namespace][method]) {
                            data[name] = args.shift();
                        }

                        return module.exports._call(name, data);
                    };
                }
            }
        }),
        _connect: () => {
            return new Promise((resolve, reject) => {
                let url = "ws://" + params.hostname + ":" + params.port;

                io = socket(url);

                io.on("connect", () => {
                    connected = true;
                    resolve();
                });

                io.on("connect_error", error => {
                    connected = false;
                    reject("Error while connecting to " + url + ", " + error);
                });

                io.on("connect_timeout", () => {
                    connected = false;
                    reject("Connection timed out while connecting to " + url);
                });

                io.on("disconnect", () => {
                    connected = false;
                    console.error("Dis_connected from server...");
                });
            });
        },
        _call: (method, args) => {
            return new Promise((resolve, reject) => {
                if (!connected) {
                    return reject("Not connected");
                }

                io.emit(method, args || {}, (error, result) => {
                    if (error) {
                        return reject(error);
                    }

                    resolve(result);
                });
            });
        },
        disconnect: co(function* () {
            io.close();
            connected = false;
        })
    };
});
