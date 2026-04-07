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
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.payload = body;
    return this;
  },
});

describe("changePass authorization regressions", () => {
  it("allows a user to change their own password", async () => {
    let updateArgs = null;

    const authController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/auth.controller.js"),
      {
        "../models/users": {
          findOne() {
            return Promise.resolve({ _id: "user-1" });
          },
          updateOne(query, update) {
            updateArgs = { query, update };
            return Promise.resolve({ acknowledged: true, modifiedCount: 1 });
          },
        },
        bcryptjs: {
          hash(password) {
            return Promise.resolve(`hashed:${password}`);
          },
        },
      }
    );

    const res = createResponseRecorder();

    await authController.changePass(
      {
        user: { _id: "user-1", isAdmin: false },
        body: { _id: "user-1", password: "new-secret" },
      },
      res
    );

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.payload, {
      message: "Password Changed Successfully",
      id: { acknowledged: true, modifiedCount: 1 },
    });
    assert.deepStrictEqual(updateArgs, {
      query: { _id: "user-1" },
      update: { password: "hashed:new-secret" },
    });
  });

  it("allows an admin to change another user's password", async () => {
    const authController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/auth.controller.js"),
      {
        "../models/users": {
          findOne() {
            return Promise.resolve({ _id: "target-user" });
          },
          updateOne() {
            return Promise.resolve({ acknowledged: true, modifiedCount: 1 });
          },
        },
        bcryptjs: {
          hash(password) {
            return Promise.resolve(`hashed:${password}`);
          },
        },
      }
    );

    const res = createResponseRecorder();

    await authController.changePass(
      {
        user: { _id: "admin-1", isAdmin: true },
        body: { _id: "target-user", password: "reset-secret" },
      },
      res
    );

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.payload, {
      message: "Password Changed Successfully",
      id: { acknowledged: true, modifiedCount: 1 },
    });
  });

  it("rejects authenticated users trying to change someone else's password", async () => {
    let updateCalled = false;

    const authController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/auth.controller.js"),
      {
        "../models/users": {
          findOne() {
            throw new Error("findOne should not be called for forbidden requests");
          },
          updateOne() {
            updateCalled = true;
            throw new Error("updateOne should not be called for forbidden requests");
          },
        },
        bcryptjs: {
          hash() {
            throw new Error("hash should not be called for forbidden requests");
          },
        },
      }
    );

    const res = createResponseRecorder();

    await authController.changePass(
      {
        user: { _id: "user-1", isAdmin: false },
        body: { _id: "user-2", password: "new-secret" },
      },
      res
    );

    assert.strictEqual(res.statusCode, 403);
    assert.deepStrictEqual(res.payload, {
      message: "Not authorized to change this password",
    });
    assert.strictEqual(updateCalled, false);
  });

  it("returns not found when the target user does not exist", async () => {
    let hashCalled = false;
    let updateCalled = false;

    const authController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/auth.controller.js"),
      {
        "../models/users": {
          findOne() {
            return Promise.resolve(null);
          },
          updateOne() {
            updateCalled = true;
            return Promise.resolve({ acknowledged: true, modifiedCount: 1 });
          },
        },
        bcryptjs: {
          hash() {
            hashCalled = true;
            return Promise.resolve("hashed:new-secret");
          },
        },
      }
    );

    const res = createResponseRecorder();

    await authController.changePass(
      {
        user: { _id: "admin-1", isAdmin: true },
        body: { _id: "missing-user", password: "new-secret" },
      },
      res
    );

    assert.strictEqual(res.statusCode, 404);
    assert.deepStrictEqual(res.payload, {
      message: "User not found",
    });
    assert.strictEqual(hashCalled, false);
    assert.strictEqual(updateCalled, false);
  });
});
