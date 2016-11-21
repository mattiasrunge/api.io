"use strict";

/* global describe before after it */

const assert = require("chai").assert;
const server = require("../examples/server");
const api = require("../api.io-client");
const getPort = require("get-port");

const createDeferred = () => {
    const deferred = {};
    deferred.promise = new Promise((resolve, reject) => {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });

    return deferred;
};

describe("Test", () => {
    let port = 8080;

    before(async () => {
        port = await getPort();

        await server.run(port);
    });

    after(async () => {
        await server.stop();
    });

    describe("Client", () => {
        it("should connect", async () => {
            await api.connect({
                hostname: "localhost",
                port: port
            });
        });

        it("should successfully get a constant value", () => {
            assert.equal(api.myApi.VALUE, "const");
        });

        it("should successfully call an exported api function", async () => {
            const result = await api.myApi.sum(1, 2);

            assert.equal(result, 3);
        });

        it("should successfully call an exported api generator function", async () => {
            const result = await api.myApi.sumAsync(1, 3);

            assert.equal(result, 4);
        });

        it("should successfully get an event", async () => {
            const deferred = createDeferred();
            const subscription1 = api.myApi.on("event3", (data) => {
                try {
                    assert.equal(data, "ABC");
                    deferred.resolve();
                } catch (error) {
                    deferred.reject(error);
                }
            });

            await api.myApi.send();
            await deferred.promise;

            api.myApi.off(subscription1);
        });

        it("should not expose not-exported functions", () => {
            assert.notProperty(api.myApi, "notApi");
        });

        it("should successfully interact with second API", async () => {
            const deferred = createDeferred();
            const subscription1 = api.myApi2.on("eventX", (data) => {
                try {
                    assert.equal(data, "Over myApi2");
                    deferred.resolve();
                } catch (error) {
                    deferred.reject(error);
                }
            });

            await api.myApi2.send();
            await deferred.promise;

            api.myApi.off(subscription1);
        });
    });
});
