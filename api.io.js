"use strict";

const socket = require("socket.io");
const sift = require("sift");
const cookie = require("cookie");
const uuid = require("uuid");
const EventEmitter = require("events");

let io = null;
let definitions = {};
let objects = {};
const emitter = new EventEmitter();

const EXPORT_PROP_NAME = "__exported";

// Credits: http://stackoverflow.com/questions/30030161/javascript-function-arguments-positional-map-transition
const getParamNames = (fn) => {
    const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    const ARGUMENT_NAMES = /([^\s,]+)/g;

    const fnStr = fn.toString().replace(STRIP_COMMENTS, "");
    const result = fnStr.slice(fnStr.indexOf("(") + 1, fnStr.indexOf(")")).match(ARGUMENT_NAMES);

    return result === null ? [] : result;
};

module.exports = {
    getClient: () => require("./api.io-client"),
    start: (server, options, sessions) => {
        options = options || {};

        return new Promise((resolve) => {
            io = socket(server);

            io.set("authorization", (request, accept) => {
                if (sessions) {
                    options.sessionName = options.sessionName || "apiio";
                    options.sessionMaxAge = options.sessionMaxAge || 1000 * 60 * 60 * 24 * 7;

                    let sessionId = false;

                    if (request.headers.cookie && request.headers.cookie.indexOf(options.sessionName) !== -1) {
                        try {
                            sessionId = cookie.parse(request.headers.cookie)[options.sessionName];
                        } catch (e) {
                        }
                    }

                    if (!sessionId || !sessions[sessionId]) {
                        sessionId = uuid();

                        sessions[sessionId] = {
                            _id: sessionId
                        };
                    }

                    const session = sessions[sessionId];

                    session._expires = new Date(new Date().getTime() + options.sessionMaxAge);

                    request.session = session;
                }

                request.session = request.session || {};

                options.authHandler = options.authHandler || (() => Promise.resolve());
                options.authHandler(request)
                    .then(() => accept(null, true))
                    .catch((err) => accept(err, false));
            });

            io.on("connection", (client) => {
                client.session = client.request.session;
                client.wantedEvents = [];

                for (const namespace of Object.keys(definitions)) {
                    for (const method of Object.keys(definitions[namespace])) {
                        client.on(`${namespace}.${method}`, (data, ack) => {
                            const clientStack = data.__stack;
                            delete data.__stack;

                            module.exports._call(client.session, namespace, method, data)
                                .then((result) => {
                                    ack(null, result);
                                })
                                .catch((error) => {
                                    console.error(`Call to ${namespace}.${method} threw: ${error}`);
                                    console.error("client stack", clientStack);
                                    if (options.debug) {
                                        console.error("data", JSON.stringify(data, null, 2));
                                    }
                                    if (error.stack) {
                                        console.error(error.stack);
                                    }
                                    ack({
                                        message: error.message || error,
                                        stack: error.stack
                                    });
                                });
                        });
                    }
                }

                /* Adds event to client.wantedEvents.
                 * client.wantedEvents is an array of objects with attributes
                 * event: Event subscribed from client. If subscribed with
                 *   query, event contains an ID unique per event and query
                 *   used by the server to distinguiosh which client that belongs
                 *   to which query.
                 * baseEvent: Identifies the data that the filter query shall
                 *   be applied on. If no query is given, baseEvent === event.
                 * query: MongoDB style query using sift
                 */
                client.on("_subscribeToEvent", (event, query) => {
                    const subEventIdStartIndex = event.lastIndexOf("#");
                    let wantedEvent;
                    if (subEventIdStartIndex !== -1 && query) {
                        wantedEvent = {
                            event: event,
                            baseEvent: event.slice(0, subEventIdStartIndex),
                            query: query
                        };
                    } else if (!client.wantedEvents.some((item) => item.event === event)) {
                        // Add if not already subscribed
                        wantedEvent = {
                            event: event,
                            baseEvent: event,
                            query: false
                        };
                    }
                    if (wantedEvent) {
                        client.wantedEvents.push(wantedEvent);
                    }
                });

                client.on("_unsubscribeFromEvent", (event) => {
                    const index = client.wantedEvents.findIndex((item) => item.event === event);

                    if (index !== -1) {
                        client.wantedEvents.splice(index, 1);
                    }
                });

                client.on("disconnect", () => {
                    emitter.emit("disconnection", client);
                });

                client.on("error", (error) => {
                    console.error(`Connection error, disconnecting: ${error}`);
                    emitter.emit("disconnection", client);
                });

                emitter.emit("connection", client);

                client.emit("ready", definitions);
            });

            resolve();
        });
    },
    stop: (clearDefinition = true) => {
        return new Promise((resolve) => {
            io = null;

            if (clearDefinition) {
                definitions = {};
                objects = {};
            }

            resolve();
        });
    },
    _call: (session, namespace, method, data) => {
        if (!objects[namespace]) {
            throw new Error("No such namespace");
        }

        if (!definitions[namespace][method]) {
            throw new Error("No such method");
        }

        if (definitions[namespace][method].type !== "function") {
            throw new Error("Call on non-function");
        }

        const args = definitions[namespace][method].value.map((name) => data[name]);
        args.unshift(session);

        return Promise.resolve(objects[namespace][method](...args));
    },
    register: (namespace, obj) => {
        definitions[namespace] = {};
        objects[namespace] = obj;

        for (const name of Object.keys(obj)) {
            if (name[0] === "_") {
                // Private parameter
                continue;
            } else if (module.exports._isExported(obj[name])) {
                const params = getParamNames(obj[name]);
                params.shift(); // Remove session

                definitions[namespace][name] = { type: "function", value: params };
            } else if (obj[name].constructor.name === "Function") {
                // non-exported function, skip it
                continue;
            } else {
                // Everything else is an exported constant
                definitions[namespace][name] = { type: "constant", value: obj[name] };
            }
        }

        obj.emit = function(event, data, sessionFilter) {
            if (!io) {
                return;
            }

            const nsevent = `${namespace}.${event}`;

            Object.keys(io.sockets.sockets)
                .map((id) => {
                    return io.sockets.sockets[id];
                })
                .filter((client) => {
                    if (sessionFilter && typeof sessionFilter === "object") {
                        for (const key of Object.keys(sessionFilter)) {
                            if (sessionFilter[key] !== client.session[key]) {
                                return false;
                            }
                        }
                    }

                    if (!client.wantedEvents.some((item) => item.baseEvent === nsevent)) {
                        return false;
                    }

                    return true;
                })
                .forEach((client) => {
                    const eventInfos = client.wantedEvents.filter((item) => item.baseEvent === nsevent);
                    for (const eventInfo of eventInfos) {
                        if (eventInfo.query) {
                            const matches = sift(eventInfo.query, [ data ]);
                            if (matches.length > 0) {
                                client.emit(eventInfo.event, data);
                            }
                        } else {
                            client.emit(eventInfo.event, data);
                        }
                    }
                });
        };

        obj.namespace = namespace;

        emitter.emit("namespace", namespace);

        module.exports[namespace] = obj;

        return obj;
    },
    isRegistered: (namespace) => {
        return !!definitions[namespace];
    },
    export: (func) => {
        // TODO: Add export for denotation for others than functions, need to wrap simple types
        if (typeof func === "function") {
            func[EXPORT_PROP_NAME] = true;
        }

        return func;
    },
    _isExported: (func) => {
        return (typeof func === "function") && (func[EXPORT_PROP_NAME] === true);
    },
    on: (event, fn) => {
        const events = event.split("|");

        for (const event of events) {
            emitter.on(event, fn);
        }

        return { events: events, fn: fn };
    },
    off: (subscription) => {
        const subscriptions = subscription instanceof Array ? subscription : [ subscription ];

        for (const subscription of subscriptions) {
            for (const event of subscription.events) {
                emitter.removeListener(event, subscription.fn);
            }
        }
    }
};
