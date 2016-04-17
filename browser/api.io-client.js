define(["module", "socket.io-client", "co"], function (module, socket, co) {
    "use strict";

    let Client = function () {
        let io = null;
        let params = {};
        let connected = false;

        this.connect = config => {
            params = config;

            return new Promise((resolve, reject) => {
                let url = "ws://" + params.hostname + ":" + params.port;

                io = socket(url);

                io.on("connect", () => {
                    connected = true;
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
                    console.error("Disconnected from server...");
                });

                io.on("ready", definitions => {
                    for (let namespace of Object.keys(definitions)) {
                        module.exports[namespace] = {};

                        for (let method of Object.keys(definitions[namespace])) {
                            module.exports[namespace][method] = function () {
                                let name = namespace + "." + method;
                                let args = Array.from(arguments);
                                let data = {};

                                for (let name of definitions[namespace][method]) {
                                    data[name] = args.shift();
                                }

                                return module.exports._call(name, data);
                            };
                        }

                        module.exports[namespace].on = (event, fn) => {
                            if (fn.constructor.name === "GeneratorFunction") {
                                fn = co.wrap(fn);
                            }

                            io.on(namespace + "." + event, fn);
                            return { event: namespace + "." + event, fn: fn };
                        };

                        module.exports[namespace].off = subscription => {
                            io.removeListener(subscription.event, subscription.fn);
                        };
                    }

                    resolve();
                });
            });
        };

        this._call = (method, args) => {
            args = args || {};
            args.__stack = new Error().stack;

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
        };

        this.disconnect = () => {
            return new Promise(resolve => {
                io.close();
                connected = false;
                resolve();
            });
        };
    };

    Client.create = () => {
        return new Client();
    };

    module.exports = Client.create();
});
