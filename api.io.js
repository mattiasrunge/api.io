"use strict";

const socket = require("socket.io");
const EventEmitter = require("events");
const util = require("util");
const Bluebird = require("bluebird");
const co = Bluebird.coroutine;

let io = null;
let definitions = {};
let objects = {};
let emitter = new EventEmitter();

const getParamNames = (fn) => {
    const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    const ARGUMENT_NAMES = /([^\s,]+)/g;

    let fnStr = fn.toString().replace(STRIP_COMMENTS, "");
    let result = fnStr.slice(fnStr.indexOf("(") + 1, fnStr.indexOf(")")).match(ARGUMENT_NAMES);

    return result === null ? [] : result;
};

module.exports = {
    start: co(function*(server) {
        io = socket(server);

        io.on("connection", (client) => {
            client.session = client.session || {};

            client.on("api", (data, ack) => {
                ack(null, definitions);
            });

            for (let namespace of Object.keys(definitions)) {
                for (let method of Object.keys(definitions[namespace])) {
                    client.on(namespace + "." + method, (data, ack) => {
                        module.exports._call(client.session, namespace, method, data)
                        .then((result) => {
                            ack(null, result);
                        })
                        .catch((error) => {
                            console.error("Call to " + namespace + "." + method + " threw: " + error);
                            console.error("data", JSON.stringify(data, null, 2));
                            console.error(error.stack);
                            ack(error.stack);
                        });
                    });
                }
            }

            emitter.emit("connection", client);
        });

        io.on("disconnection", (client) => {
            emitter.emit("disconnection", client);
        });
    }),
    stop: co(function*() {
        io = null;
        definitions = {};
        objects = {};
    }),
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
    co: (fn) => {
        let cofn = co(fn);
        cofn.params = getParamNames(fn);
        cofn.params.shift(); // Remove session from list
        return cofn;
    },
    register: (namespace, obj) => {
        definitions[namespace] = {};
        objects[namespace] = obj;

        for (let name of Object.keys(obj)) {
            if (typeof obj[name].params !== "undefined") {
                definitions[namespace][name] = obj[name].params;
            }
        }

        emitter.emit("namespace", namespace);

        return obj;
    },
    on: (event, fn) => {
        emitter.on(event, fn);
    }
};
