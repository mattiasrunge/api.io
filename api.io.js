"use strict";

const fs = require("fs");
const path = require("path");
const socket = require("socket.io");
const cookie = require("cookie");
const uuid = require("node-uuid");
const EventEmitter = require("events");
const co = require("co");
const version = require("./package.json").version;

let io = null;
let definitions = {};
let objects = {};
let emitter = new EventEmitter();
let files = {};

// Credits: http://stackoverflow.com/questions/30030161/javascript-function-arguments-positional-map-transition
const getParamNames = (fn) => {
    const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    const ARGUMENT_NAMES = /([^\s,]+)/g;

    let fnStr = fn.toString().replace(STRIP_COMMENTS, "");
    let result = fnStr.slice(fnStr.indexOf("(") + 1, fnStr.indexOf(")")).match(ARGUMENT_NAMES);

    return result === null ? [] : result;
};

// Credits: File serving is inspired by how socket.io does it
module.exports = {
    client: require("./api.io-client"),
    start: (server, sessions) => {
        return new Promise((resolve) => {
            module.exports._addRoutes(server);

            io = socket(server);

            io.set("authorization", function(request, accept) {
                if (sessions) {
                    if (request.headers.cookie && request.headers.cookie.indexOf("api.io-authorization") !== -1) {
                        request.sessionCookie = cookie.parse(request.headers.cookie)["api.io-authorization"];
                        request.sessionId = JSON.parse(new Buffer(request.sessionCookie, "base64")).sessionId;
                    }

                    if (typeof request.sessionId === "undefined" || !sessions[request.sessionId]) {
                        request.sessionId = uuid.v4();

                        sessions[request.sessionId] = {
                            sessionId: request.sessionId
                        };
                    }
                }

                accept(null, true);
            });

            io.on("connection", (client) => {
                if (client.request.sessionId && sessions) {
                    client.session = sessions[client.request.sessionId];
                }

                client.session = client.session || {};

                for (let namespace of Object.keys(definitions)) {
                    for (let method of Object.keys(definitions[namespace])) {
                        client.on(namespace + "." + method, (data, ack) => {
                            let clientStack = data.__stack;
                            delete data.__stack;

                            module.exports._call(client.session, namespace, method, data)
                            .then((result) => {
                                ack(null, result);
                            })
                            .catch((error) => {
                                console.error("Call to " + namespace + "." + method + " threw: " + error);
                                console.error("client stack", clientStack);
                                console.error("data", JSON.stringify(data, null, 2));
                                console.error(error.stack);
                                ack(error.stack);
                            });
                        });
                    }
                }

                emitter.emit("connection", client);

                client.emit("ready", definitions);
            });

            io.on("disconnection", (client) => {
                emitter.emit("disconnection", client);
            });

            resolve();
        });
    },
    stop: () => {
        return new Promise((resolve) => {
            io = null;
            definitions = {};
            objects = {};
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

        let args = definitions[namespace][method].map((name) => data[name]);
        args.unshift(session);

        return objects[namespace][method].apply(objects[namespace], args);
    },
    _addRoutes: (server) => {
        let listeners = server.listeners("request").slice(0);
        server.removeAllListeners("request");

        server.on("request", (request, response) => {
            let url = path.normalize(request.url);

            if (url.indexOf("/api.io/") === 0) {
                module.exports._serveFiles(request, response, url);
            } else {
                for (let listener of listeners) {
                    listener.call(server, request, response);
                }
            }
        });
    },
    _serveFiles: (request, response, url) => {
        let etag = request.headers["if-none-match"];

        if (etag) {
            if (version === etag) {
                response.writeHead(304);
                response.end();
                return;
            }
        }

        module.exports._getFileData(url.replace("/api.io/", ""))
        .then((data) => {
            response.setHeader("Content-Type", "application/javascript");
            response.setHeader("ETag", version);
            response.writeHead(200);
            response.end(data);
        })
        .catch((error, status) => {
            response.writeHead(status);
            response.end(error);
        });
    },
    _getFileData: function(url) {
        return new Promise((resolve, reject) => {
            if (files[url]) {
                return resolve(files[url]);
            }

            let filename = path.resolve(__dirname, "browser", url);

            fs.access(filename, fs.R_OK, (error) => {
                if (error) {
                    return reject(error, 404);
                }

                fs.readFile(filename, (error, data) => {
                    if (error) {
                        return reject(error, 500);
                    }

                    files[url] = data;
                    resolve(data);
                });
            });
        });
    },
    register: (namespace, obj) => {
        definitions[namespace] = {};
        objects[namespace] = obj;

        for (let name of Object.keys(obj)) {
            if (name[0] === "_" || obj[name].constructor.name !== "GeneratorFunction") {
                continue;
            }

            definitions[namespace][name] = getParamNames(obj[name]);
            definitions[namespace][name].shift(); // Remove session
            obj[name] = co.wrap(obj[name]);
        }

        obj.emit = function(event, data, sessionFilter) {
            if (!io) {
                return;
            }

            if (!sessionFilter || typeof sessionFilter !== "object") {
                return io.emit(namespace + "." + event, data);
            }

            Object.keys(io.sockets.sockets)
            .map((id) => {
                return io.sockets.sockets[id];
            })
            .filter((client) => {
                for (let key of Object.keys(sessionFilter)) {
                    if (sessionFilter[key] !== client.session[key]) {
                        return false;
                    }
                }

                return true;
            })
            .forEach((client) => {
                client.emit(namespace + "." + event, data);
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
    on: (event, fn) => {
        if (fn.constructor.name === "GeneratorFunction") {
            fn = co.wrap(fn);
        }

        emitter.on(event, fn);
        return { event: event, fn: fn };
    },
    off: (subscription) => {
        emitter.removeListener(subscription.event, subscription.fn);
    }
};
