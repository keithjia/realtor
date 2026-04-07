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

describe("property upload safety regressions", () => {
  it("configures bounded in-memory uploads for property images", () => {
    /*
     * Regression test for:
     *
     * High: the property upload route used multer.memoryStorage() with no
     * limits, making the process vulnerable to memory exhaustion.
     *
     * This test locks in explicit file count and file size limits on the
     * in-memory upload middleware.
     */
    let capturedOptions = null;

    const multerStub = function multer(options) {
      capturedOptions = options;
      return {
        array: () => (req, res, next) => next(),
      };
    };
    multerStub.memoryStorage = () => ({ engine: "memory" });

    loadModuleWithStubs(
      path.resolve(__dirname, "../server/routes/property.js"),
      {
        multer: multerStub,
        mongoose: {
          connection: {
            once: () => {},
          },
          mongo: {
            GridFsStorage: function GridFsStorage() {},
          },
        },
        "../controllers/property.controller": {
          propertyTypeList: (req, res) => res.status(200).json({}),
          addPropertyType: (req, res) => res.status(200).json({}),
          addNewProperty: (req, res) => res.status(200).json({}),
          getUserList: (req, res) => res.status(200).json({}),
          getFullList: (req, res) => res.status(200).json({}),
          getSingleProperty: (req, res) => res.status(200).json({}),
          showGFSImage: (req, res) => res.status(200).json({}),
          markAsSold: (req, res) => res.status(200).json({}),
          filterProperties: (req, res) => res.status(200).json({}),
        },
      }
    );

    assert.deepStrictEqual(capturedOptions, {
      storage: { engine: "memory" },
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 5,
      },
    });
  });

  it("rejects uploaded files when the storage backend is unavailable", async () => {
    let propertySaved = false;

    function PropertyStub() {
      this.save = async () => {
        propertySaved = true;
        return { _id: "property-1", slug: "unused" };
      };
    }

    const propertyController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/property.controller.js"),
      {
        "../providers/helper": {
          slugGenerator: async () => "safe-slug",
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
        gfs: null,
        files: [{ originalname: "house.png" }],
        body: {
          title: "Unsafe Upload",
          Proptype: "type-1",
          isSociety: false,
        },
      },
      res
    );

    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(res.payload, {
      message: "Image storage backend is not available",
    });
    assert.strictEqual(propertySaved, false);
  });
});
