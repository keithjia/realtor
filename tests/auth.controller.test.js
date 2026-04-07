const assert = require("assert");
const Module = require("module");
const path = require("path");

describe("auth controller regression coverage", () => {
  it("does not execute remote code on module load", () => {
    /*
     * Regression test for:
     *
     * 1. Critical: remote code execution backdoor on module load.
     * auth.controller.js fetched remote content at startup and passed
     * res.data.cookie into errorHandler.js, which executed it via
     * new Function.constructor(...). That allowed arbitrary code execution
     * from a network response before any request handling.
     *
     * This test ensures loading the auth controller does not even request
     * axios, which was the entry point for the startup fetch side effect.
     */
    const authControllerPath = path.resolve(
      __dirname,
      "../server/controllers/auth.controller.js"
    );
    const originalLoad = Module._load;
    let axiosRequested = false;

    delete require.cache[authControllerPath];

    Module._load = function patchedLoad(request, parent, isMain) {
      if (request === "axios") {
        axiosRequested = true;
        throw new Error("auth.controller should not load axios on import");
      }

      return originalLoad.apply(this, arguments);
    };

    try {
      assert.doesNotThrow(() => {
        require(authControllerPath);
      });
      assert.strictEqual(axiosRequested, false);
    } finally {
      Module._load = originalLoad;
      delete require.cache[authControllerPath];
    }
  });
});
