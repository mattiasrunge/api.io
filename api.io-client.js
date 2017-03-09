"use strict";

const socket = require("socket.io-client");

const Client = function() {
    let io = null;
    let params = {};
    let connected = false;

    this.connect = (config, statusFn) => {
        params = config;
        statusFn = statusFn || function() {};

        return new Promise((resolve, reject) => {
            const protocol = params.secure ? "wss" : "ws";
            const url = `${protocol}://${params.hostname}:${params.port}`;
            const options = {
                secure: params.secure
            };

            if (config.sessionId) {
                const sessionName = config.sessionName || "apiio";

                options.extraHeaders = {
                    cookie: `${sessionName}=${config.sessionId}`
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
                const errorString = `Error while connecting to ${url}, ${error}`;
                reject(errorString);
                statusFn("error", errorString);
            });

            io.on("connect_timeout", (error) => {
                connected = false;
                const errorString = `Timed out while connecting to ${url}, ${error}`;
                reject(errorString);
                statusFn("timeout", errorString);
            });

            io.on("reconnect_failed", (error) => {
                connected = false;
                const errorString = `Error while reconnecting to ${url}, ${error}`;
                statusFn("error", errorString);
            });

            io.on("disconnect", () => {
                connected = false;
                statusFn("disconnect");
            });

            io.on("ready", (definitions) => {
                // TODO: Check some sort of version, definitions might have changed
                for (const namespace of Object.keys(definitions)) {
                    this[namespace] = {};

                    for (const itemName of Object.keys(definitions[namespace])) {
                        const item = definitions[namespace][itemName];

                        if (item.type === "function") {
                            const method = `${namespace}.${itemName}`;
                            const argNames = item.value;

                            this[namespace][itemName] = function(...args) {
                                const data = {};

                                for (const name of argNames) {
                                    data[name] = args.shift();
                                }

                                return this._call(method, data);
                            }.bind(this);
                        } else if (item.type === "constant") {
                            this[namespace][itemName] = item.value;
                        } else {
                            throw new Error(`Unknown item type: ${item.type}`);
                        }
                    }

                    this[namespace].on = function(ns, event, fn, opts) {
                        opts = typeof opts !== "undefined" ? opts : {
                            id: false,
                            query: false
                        };
                        const events = event.split("|");
                        // If a filter query is used, add a suffix to subscribed
                        // event to distinguiosh subscriptions for same event
                        // but with different filter queries.
                        const subEventIdSuffix = opts.query !== false ? `#${opts.id}` : "";

                        for (const event of events) {
                            const nsevent = `${ns}.${event}${subEventIdSuffix}`;

                            io.emit("_subscribeToEvent", nsevent, opts.query);
                            io.on(nsevent, fn);
                        }

                        return { events: events, namespace: ns, fn: fn, subEventIdSuffix: subEventIdSuffix };
                    }.bind(this, namespace);

                    this[namespace].off = (subscription) => {
                        const subscriptions = subscription instanceof Array ? subscription : [ subscription ];

                        for (const subscription of subscriptions) {
                            for (const event of subscription.events) {
                                const nsevent = `${subscription.namespace}.${event}${subscription.subEventIdSuffix}`;

                                io.removeListener(nsevent, subscription.fn);
                                io.emit("_unsubscribeFromEvent", nsevent);
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
                    console.error(`api.io call to ${method} failed: ${error.message}`, error);
                    const err = new Error(error.message);
                    return reject(err);
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
