define(["module", "socket.io-client", "co"], function (module, socket, co) {
    "use strict";

    let Client = function () {
        let io = null;
        let params = {};
        let connected = false;

        this.connect = (config, statusFn) => {
            params = config;
            statusFn = statusFn || function () {};

            return new Promise((resolve, reject) => {
                let url = "ws://" + params.hostname + ":" + params.port;

                io = socket(url);

                io.on("connect", () => {
                    connected = true;
                    statusFn("connect");
                });

                io.on("reconnect", () => {
                    connected = true;
                    statusFn("reconnect");
                });

                io.on("connect_error", error => {
                    connected = false;
                    reject("Error while connecting to " + url + ", " + error);
                    statusFn("error", "Error while connecting to " + url + ", " + error);
                });

                io.on("connect_timeout", error => {
                    connected = false;
                    reject("Timed out while connecting to " + url);
                    statusFn("timeout", "Timeout while connecting to " + url + ", " + error);
                });

                io.on("reconnect_failed", error => {
                    connected = false;
                    statusFn("error", "Error while reconnecting to " + url + ", " + error);
                });

                io.on("disconnect", () => {
                    connected = false;
                    statusFn("disconnect");
                });

                io.on("ready", definitions => {
                    // TODO: Check some sort of version, definitions might have changed
                    for (let namespace of Object.keys(definitions)) {
                        this[namespace] = {};

                        for (let method of Object.keys(definitions[namespace])) {
                            this[namespace][method] = function () {
                                let name = namespace + "." + method;
                                let args = Array.from(arguments);
                                let data = {};

                                for (let name of definitions[namespace][method]) {
                                    data[name] = args.shift();
                                }

                                return this._call(name, data);
                            }.bind(this);
                        }

                        this[namespace].on = (event, fn) => {
                            if (fn.constructor.name === "GeneratorFunction") {
                                fn = co.wrap(fn);
                            }

                            io.on(namespace + "." + event, fn);
                            return { event: namespace + "." + event, fn: fn };
                        };

                        this[namespace].off = subscription => {
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

        this.create = () => {
            return new Client();
        };
    };

    module.exports = new Client();
});
