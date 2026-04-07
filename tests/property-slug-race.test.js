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

describe("property slug race regressions", () => {
  it("marks property slugs as unique in the schema", () => {
    /*
     * Regression test for:
     *
     * Medium: slug generation used a read-then-insert loop, but the property
     * schema did not enforce slug uniqueness. Concurrent requests could still
     * insert duplicate slugs.
     *
     * This test locks in the database-level uniqueness requirement that
     * prevents duplicate slug writes during races.
     */
    const propertyModel = require("../server/models/property");
    const slugPath = propertyModel.schema.path("slug");

    assert.strictEqual(slugPath.options.unique, true);
  });

  it("returns a conflict response when a duplicate slug write occurs", async () => {
    function PropertyStub() {
      this.save = async () => {
        const err = new Error("duplicate key");
        err.code = 11000;
        err.keyPattern = { slug: 1 };
        throw err;
      };
    }

    const propertyController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/property.controller.js"),
      {
        "../providers/helper": {
          slugGenerator: async () => "duplicate-slug",
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

    await propertyController.addNewProperty(
      {
        user: { _id: "user-1" },
        gfs: { files: {} },
        files: [],
        body: {
          title: "Duplicate Listing",
          Proptype: "type-1",
          isSociety: false,
        },
      },
      res
    );

    assert.strictEqual(res.statusCode, 409);
    assert.deepStrictEqual(res.payload, {
      message: "A property with this slug already exists",
    });
  });
});
