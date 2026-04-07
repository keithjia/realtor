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

describe("query pagination regressions", () => {
  it("derives bounded pagination defaults and caps oversized limits", () => {
    const helpers = require("../server/providers/helper");

    assert.deepStrictEqual(helpers.getPagination({}), {
      page: 1,
      limit: 20,
      skip: 0,
    });
    assert.deepStrictEqual(helpers.getPagination({ page: "3", limit: "500" }), {
      page: 3,
      limit: 100,
      skip: 200,
    });
  });

  it("applies pagination to the admin user list query", async () => {
    let limitValue = null;
    let skipValue = null;

    const authController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/auth.controller.js"),
      {
        "../models/users": {
          find() {
            return {
              select() {
                return this;
              },
              limit(value) {
                limitValue = value;
                return this;
              },
              skip(value) {
                skipValue = value;
                return Promise.resolve([]);
              },
            };
          },
        },
      }
    );

    const res = {
      statusCode: null,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.payload = body;
        return this;
      },
    };

    await authController.userList({ query: { page: "2", limit: "15" } }, res);

    assert.strictEqual(limitValue, 15);
    assert.strictEqual(skipValue, 15);
    assert.strictEqual(res.statusCode, 200);
  });

  it("applies pagination to the all-cities query", () => {
    let limitValue = null;
    let skipValue = null;

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
              limit(value) {
                limitValue = value;
                return this;
              },
              skip(value) {
                skipValue = value;
                return this;
              },
              exec(callback) {
                callback(null, []);
              },
            };
          },
        },
        "../models/users": {},
      }
    );

    const res = {
      statusCode: null,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.payload = body;
        return this;
      },
    };

    commonController.getAllCities({ query: { page: "4", limit: "25" } }, res);

    assert.strictEqual(limitValue, 25);
    assert.strictEqual(skipValue, 75);
    assert.strictEqual(res.statusCode, 200);
  });

  it("applies pagination to the city-by-state query", () => {
    let limitValue = null;
    let skipValue = null;

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
              limit(value) {
                limitValue = value;
                return this;
              },
              skip(value) {
                skipValue = value;
                return this;
              },
              exec(callback) {
                callback(null, []);
              },
            };
          },
        },
        "../models/users": {},
      }
    );

    const res = {
      statusCode: null,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.payload = body;
        return this;
      },
    };

    commonController.getCityList(
      { params: { state_id: "state-1" }, query: { page: "2", limit: "30" } },
      res
    );

    assert.strictEqual(limitValue, 30);
    assert.strictEqual(skipValue, 30);
    assert.strictEqual(res.statusCode, 200);
  });

  it("applies pagination to property list and filter queries", () => {
    const captures = [];
    const makeQueryChain = () => ({
      select() {
        return this;
      },
      populate() {
        return this;
      },
      limit(value) {
        captures.push(["limit", value]);
        return this;
      },
      skip(value) {
        captures.push(["skip", value]);
        return this;
      },
      exec(callback) {
        callback(null, []);
      },
    });

    const propertyController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/property.controller.js"),
      {
        "../providers/helper": {
          ...require("../server/providers/helper"),
        },
        "../models/propertyTypes": {},
        "../models/property": {
          find() {
            return makeQueryChain();
          },
        },
        mongoose: {
          connection: {
            on: () => {},
          },
          mongo: {},
        },
        "gridfs-stream": () => ({}),
      }
    );

    const res = {
      statusCode: null,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.payload = body;
        return this;
      },
      send(body) {
        this.payload = body;
        return this;
      },
    };

    propertyController.getFullList({ query: { page: "2", limit: "10" } }, res);
    propertyController.filterProperties({ query: { page: "3", limit: "1000" } }, res);
    propertyController.getUserList(
      { params: { userId: "user-1" }, query: { page: "4", limit: "12" } },
      res
    );

    assert.deepStrictEqual(captures, [
      ["limit", 10],
      ["skip", 10],
      ["limit", 100],
      ["skip", 200],
      ["limit", 12],
      ["skip", 36],
    ]);
  });
});
