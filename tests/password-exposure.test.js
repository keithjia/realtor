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

describe("password exposure regressions", () => {
  it("marks the password field as excluded by default in the user schema", () => {
    const userModel = require("../server/models/users");
    const passwordPath = userModel.schema.path("password");

    assert.strictEqual(passwordPath.options.select, false);
  });

  it("excludes password hashes from the admin user list response query", async () => {
    /*
     * Regression test for:
     *
     * 3. Critical: password hashes are exposed through public APIs.
     * auth.controller.js returned userM.find() with full documents, and
     * users.controller.js returned a full user record by ID. The schema in
     * users.js did not mark password as excluded, so hashed passwords were leaked.
     *
     * This test locks in an explicit projection at the query layer so the
     * controller cannot accidentally return password hashes even if schema
     * defaults change later.
     */
    let selectArg = null;
    let execCalled = false;

    const authController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/auth.controller.js"),
      {
        "../models/users": {
          find: () => ({
            select(value) {
              selectArg = value;
              execCalled = true;
              return Promise.resolve([]);
            },
          }),
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

    await authController.userList({}, res);

    assert.strictEqual(selectArg, "-password");
    assert.strictEqual(execCalled, true);
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.payload, { message: "Success", data: [] });
  });

  it("excludes password hashes from user detail lookups", () => {
    let selectArg = null;
    let populateCalls = [];
    let execCalled = false;

    const usersController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/users.controller.js"),
      {
        "../models/users": {
          findOne: (query) => ({
            select(value) {
              selectArg = value;
              return this;
            },
            populate(pathName, fields) {
              populateCalls.push([pathName, fields]);
              return this;
            },
            exec(callback) {
              execCalled = true;
              callback(null, { _id: query._id });
            },
          }),
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
      send(body) {
        this.payload = body;
        return this;
      },
    };

    usersController.getUserDetails({ params: { userId: "abc123" } }, res);

    assert.strictEqual(selectArg, "-password");
    assert.deepStrictEqual(populateCalls, [
      ["city", "name"],
      ["state", "name"],
    ]);
    assert.strictEqual(execCalled, true);
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.payload, { _id: "abc123" });
  });
});
