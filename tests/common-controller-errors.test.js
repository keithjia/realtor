const assert = require("assert");
const Module = require("module");
const path = require("path");

const loadModuleWithStubs = (modulePath, stubs) => {
  const originalLoad = Module._load;
  const resolvedModulePath = path.resolve(modulePath);

  delete require.cache[resolvedModulePath];

  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) {
      return stubs[request];
    }

    return originalLoad.apply(this, arguments);
  };

  try {
    return require(resolvedModulePath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[resolvedModulePath];
  }
};

const createResponseRecorder = () => ({
  statusCode: null,
  sent: null,
  jsonBody: null,
  sendCalls: 0,
  jsonCalls: 0,
  status(code) {
    this.statusCode = code;
    return this;
  },
  send(payload) {
    this.sendCalls += 1;
    this.sent = payload;
    return this;
  },
  json(payload) {
    this.jsonCalls += 1;
    this.jsonBody = payload;
    return this;
  },
});

describe("common controller error flow regressions", () => {
  it("does not send a success response after getStateList errors", () => {
    const expectedError = new Error("state query failed");
    const commonController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/common.controller.js"),
      {
        "../models/state": {
          find() {
            return {
              exec(callback) {
                callback(expectedError);
              },
            };
          },
        },
        "../models/city": {},
        "../models/users": {},
      }
    );

    const res = createResponseRecorder();
    commonController.getStateList({}, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.sendCalls, 0);
    assert.strictEqual(res.jsonCalls, 1);
    assert.deepStrictEqual(res.jsonBody, {
      message: 'Unable to fetch states'
    });
  });

  it("does not send a success response after getAllCities errors", () => {
    const expectedError = new Error("city query failed");
    const commonController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/common.controller.js"),
      {
        "../models/state": {},
        "../models/city": {
          find() {
            return {
              populate() {
                return this;
              },
              limit() {
                return this;
              },
              skip() {
                return this;
              },
              exec(callback) {
                callback(expectedError);
              },
            };
          },
        },
        "../models/users": {},
      }
    );

    const res = createResponseRecorder();
    commonController.getAllCities({}, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.sendCalls, 0);
    assert.strictEqual(res.jsonCalls, 1);
    assert.deepStrictEqual(res.jsonBody, {
      message: 'Unable to fetch cities'
    });
  });

  it("does not send a success response after getCityList errors", () => {
    const expectedError = new Error("filtered city query failed");
    const commonController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/common.controller.js"),
      {
        "../models/state": {},
        "../models/city": {
          find() {
            return {
              populate() {
                return this;
              },
              limit() {
                return this;
              },
              skip() {
                return this;
              },
              exec(callback) {
                callback(expectedError);
              },
            };
          },
        },
        "../models/users": {},
      }
    );

    const res = createResponseRecorder();
    commonController.getCityList({ params: { state_id: "state-1" } }, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.sendCalls, 0);
    assert.strictEqual(res.jsonCalls, 1);
    assert.deepStrictEqual(res.jsonBody, {
      message: 'Unable to fetch cities for state'
    });
  });

  it("does not send a success response after removeCity errors", () => {
    const expectedError = new Error("remove failed");
    const commonController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/common.controller.js"),
      {
        "../models/state": {},
        "../models/city": {
          remove(query, callback) {
            callback(expectedError);
          },
        },
        "../models/users": {},
      }
    );

    const res = createResponseRecorder();
    commonController.removeCity({ params: { cityId: "city-1" } }, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.sendCalls, 0);
    assert.strictEqual(res.jsonCalls, 1);
    assert.deepStrictEqual(res.jsonBody, {
      message: 'Unable to remove city'
    });
  });
});
