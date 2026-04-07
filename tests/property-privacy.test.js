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

describe("property privacy regressions", () => {
  it("excludes owner and contact fields from public property queries", async () => {
    const selects = [];
    const populates = [];

    const makeQueryChain = () => ({
      select(value) {
        selects.push(value);
        return this;
      },
      populate(field) {
        populates.push(field);
        return this;
      },
      limit() {
        return this;
      },
      skip() {
        return this;
      },
      exec(callback) {
        callback(null, []);
      },
      then(resolve) {
        return Promise.resolve(resolve({ images: [] }));
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
          findOne() {
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
    };

    propertyController.getFullList({ query: {} }, res);
    propertyController.filterProperties({ query: {} }, res);
    await propertyController.getSingleProperty({ params: { propertySlug: "slug-1" }, gfs: null }, res);

    assert.deepStrictEqual(selects, [
      "-email -phoneNo -userId",
      "-email -phoneNo -userId",
      "-email -phoneNo -userId",
    ]);
    assert.ok(!populates.includes("userId"));
  });
});
