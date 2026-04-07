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

describe("property ownership regressions", () => {
  it("binds new property ownership to the authenticated user instead of req.body.userId", async () => {
    /*
     * Regression test for:
     *
     * High: authenticated property creation trusted req.body.userId, so any
     * logged-in user could create listings on behalf of another user.
     *
     * This test ensures addNewProperty overwrites any caller-supplied userId
     * with the authenticated principal from req.user.
     */
    let persistedPayload = null;

    function PropertyStub(data) {
      persistedPayload = { ...data };
      this.save = () =>
        Promise.resolve({
          ...persistedPayload,
          _id: "property-1",
          slug: persistedPayload.slug,
        });
    }

    const propertyController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/property.controller.js"),
      {
        "../providers/helper": {
          slugGenerator: async () => "secure-slug",
        },
        "../models/propertyTypes": {},
        "../models/property": PropertyStub,
        mongoose: {
          connection: {
            on: () => {},
          },
          mongo: {},
        },
        "gridfs-stream": () => ({}),
      }
    );

    const req = {
      user: { _id: "authenticated-user" },
      body: {
        title: "New Listing",
        Proptype: "type-1",
        userId: "forged-user",
        isSociety: false,
      },
      files: [],
    };
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

    await propertyController.addNewProperty(req, res);

    assert.strictEqual(persistedPayload.userId, "authenticated-user");
    assert.strictEqual(req.body.userId, "authenticated-user");
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload.result.userId, "authenticated-user");
  });
});
