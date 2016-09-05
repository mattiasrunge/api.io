"use strict";

const socket = require("socket.io-client");
const co = require("co");

let Client = function() {
    let io = null;
    let params = {};
    let connected = false;

    this.connect = (config, statusFn) => {
        params = config;
        statusFn = statusFn || function() {};

        return new Promise((resolve, reject) => {
            let protocol = params.secure ? "wss" : "ws";
            let url = protocol + "://" + params.hostname + ":" + params.port;
            let options = {
                secure: params.secure
            };

            if (config.sessionId) {
                let sessionName = config.sessionName || "apiio";

                options.extraHeaders = {
                    cookie: sessionName + "=" + config.sessionId
                };
            }

            io = socket(url, options);

            io.on("connect", () => {
                connected = true;
                statusFn("connect");
            });

            io.on("reconnect", () => {
                connected = true;
                statusFn("reconnect");
            });

            io.on("connect_error", (error) => {
                connected = false;
                reject("Error while connecting to " + url + ", " + error);
                statusFn("error", "Error while connecting to " + url + ", " + error);
            });

            io.on("connect_timeout", (error) => {
                connected = false;
                reject("Timed out while connecting to " + url);
                statusFn("timeout", "Timeout while connecting to " + url + ", " + error);
            });

            io.on("reconnect_failed", (error) => {
                connected = false;
                statusFn("error", "Error while reconnecting to " + url + ", " + error);
            });

            io.on("disconnect", () => {
                connected = false;
                statusFn("disconnect");
            });

            io.on("ready", (definitions) => {
                // TODO: Check some sort of version, definitions might have changed
                for (let namespace of Object.keys(definitions)) {
                    this[namespace] = {};

                    for (let itemName of Object.keys(definitions[namespace])) {
                        let item = definitions[namespace][itemName];

                        if (item.type === "function") {
                            let method = namespace + "." + itemName;
                            let argNames = item.value;

                            this[namespace][itemName] = function() {
                                let args = Array.from(arguments);
                                let data = {};

                                for (let name of argNames) {
                                    data[name] = args.shift();
                                }

                                return this._call(method, data);
                            }.bind(this);
                        } else if (item.type === "constant") {
                            this[namespace][itemName] = item.value;
                        } else {
                            throw new Error("Unknown item type: " + item.type);
                        }
                    }

                    this[namespace].on = (event, fn) => {
                        if (fn.constructor.name === "GeneratorFunction") {
                            fn = co.wrap(fn);
                        }

                        let events = event.split("|");

                        for (let event of events) {
                            io.on(namespace + "." + event, fn);
                        }

                        return { events: events, namespace: namespace, fn: fn };
                    };

                    this[namespace].off = (subscription) => {
                        let subscriptions = subscription instanceof Array ? subscription : [ subscription ];

                        for (let subscription of subscriptions) {
                            for (let event of subscription.events) {
                                io.removeListener(subscription.namespace + "." + event, subscription.fn);
                            }
                        }
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
        return new Promise((resolve) => {
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
