"use strict";

const mocha = require("mocha");
const co = require("co");
const assert = require("chai").assert;
const server = require("../examples/server");
const api = require("../api.io-client");
const getPort = require("get-port");

// Create mocha-functions which deals with generators
function mochaGen(originalFn) {
    return (text, fn) => {
        fn = typeof text === "function" ? text : fn;

        if (fn.constructor.name === "GeneratorFunction") {
            let oldFn = fn;
            fn = (done) => {
                co.wrap(oldFn)()
                .then(done)
                .catch(done);
            };
        }

        if (typeof text === "function") {
            originalFn(fn);
        } else {
            originalFn(text, fn);
        }
    };
}

// Override mocha, we get W020 lint warning which we ignore since it works...
it = mochaGen(mocha.it); // jshint ignore:line
before = mochaGen(mocha.before); // jshint ignore:line
after = mochaGen(mocha.after); // jshint ignore:line

describe("Test", function() {
    this.timeout(10000);

    let port = 8080;

    before(function*() {
        port = yield getPort();

        yield server.run(port);
    });

    after(function*() {
        yield server.stop();
    });

    describe("Client", function() {
        it("should connect", function*() {
            yield api.connect({
                hostname: "localhost",
                port: port
            });
        });

        it("should successfully get a constant value", function*() {
            assert.equal(api.myApi.VALUE, "const");
        });

        it("should successfully call an exported api function", function*() {
            let result = yield api.myApi.sum(1, 2);

            assert.equal(result, 3);
        });

        it("should successfully call an exported api generator function", function*() {
            let result = yield api.myApi.sumGen(1, 3);

            assert.equal(result, 4);
        });

        it("should successfully get an event", function*() {
            let subscription1 = api.myApi.on("event3", function*(data) {
                assert.equal(data, "ABC");
            });

            yield api.myApi.send();

            api.myApi.off(subscription1);
        });

        it("should not expose not-exported functions", function*() {
            assert.notProperty(api.myApi, "notApi");
            assert.notProperty(api.myApi, "notApi2");
        });
    });
});
