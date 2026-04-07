const assert = require("assert");
const express = require("express");
const jwt = require("jsonwebtoken");
const Module = require("module");
const path = require("path");

const { secretKey } = require("../server/config/config");

const createToken = (overrides = {}) =>
  jwt.sign(
    {
      user: {
        _id: "user-1",
        email: "user@example.com",
        isAdmin: false,
        ...overrides,
      },
    },
    secretKey
  );

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

const withServer = async (router, runAssertions) => {
  const app = express();
  app.use(express.json());
  app.use(router);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await runAssertions(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
};

describe("sensitive route authorization", () => {
  it("rejects anonymous access to admin auth routes and allows admins", async () => {
    const authRouter = loadModuleWithStubs(
      path.resolve(__dirname, "../server/routes/auth.js"),
      {
        "../controllers/auth.controller": {
          userLogin: (req, res) => res.status(200).json({ route: "login" }),
          userRegistration: (req, res) => res.status(200).json({ route: "register" }),
          userList: (req, res) => res.status(200).json({ route: "userList" }),
          changePass: (req, res) => res.status(200).json({ route: "changePass" }),
        },
      }
    );

    await withServer(authRouter, async (baseUrl) => {
      const anonymousResponse = await fetch(`${baseUrl}/admin/userList`);
      assert.strictEqual(anonymousResponse.status, 401);
      assert.deepStrictEqual(await anonymousResponse.json(), {
        message: "Authentication required",
      });

      const userResponse = await fetch(`${baseUrl}/admin/userList`, {
        headers: {
          Authorization: `Bearer ${createToken()}`,
        },
      });
      assert.strictEqual(userResponse.status, 403);
      assert.deepStrictEqual(await userResponse.json(), {
        message: "Admin access required",
      });

      const adminResponse = await fetch(`${baseUrl}/admin/userList`, {
        headers: {
          Authorization: `Bearer ${createToken({ isAdmin: true })}`,
        },
      });
      assert.strictEqual(adminResponse.status, 200);
      assert.deepStrictEqual(await adminResponse.json(), {
        route: "userList",
      });
    });
  });

  it("protects common admin mutation routes", async () => {
    const commonRouter = loadModuleWithStubs(
      path.resolve(__dirname, "../server/routes/common.js"),
      {
        "../controllers/common.controller": {
          getStateList: (req, res) => res.status(200).json({ route: "getStateList" }),
          addState: (req, res) => res.status(200).json({ route: "addState" }),
          getAllCities: (req, res) => res.status(200).json({ route: "getAllCities" }),
          addCity: (req, res) => res.status(200).json({ route: "addCity" }),
          getCityList: (req, res) => res.status(200).json({ route: "getCityList" }),
          removeCity: (req, res) => res.status(200).json({ route: "removeCity" }),
          checkemailAvailability: (req, res) =>
            res.status(200).json({ route: "checkemailAvailability" }),
        },
      }
    );

    await withServer(commonRouter, async (baseUrl) => {
      const anonymousResponse = await fetch(`${baseUrl}/state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "CA" }),
      });
      assert.strictEqual(anonymousResponse.status, 401);

      const adminResponse = await fetch(`${baseUrl}/state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${createToken({ isAdmin: true })}`,
        },
        body: JSON.stringify({ name: "CA" }),
      });
      assert.strictEqual(adminResponse.status, 200);
      assert.deepStrictEqual(await adminResponse.json(), {
        route: "addState",
      });
    });
  });

  it("protects property mutation routes while allowing authenticated property creation", async () => {
    const multerStub = function multer() {
      return {
        array: () => (req, res, next) => next(),
      };
    };
    multerStub.memoryStorage = () => ({});

    const propertyRouter = loadModuleWithStubs(
      path.resolve(__dirname, "../server/routes/property.js"),
      {
        "../controllers/property.controller": {
          propertyTypeList: (req, res) => res.status(200).json({ route: "propertyTypeList" }),
          addPropertyType: (req, res) => res.status(200).json({ route: "addPropertyType" }),
          addNewProperty: (req, res) => res.status(200).json({ route: "addNewProperty" }),
          getUserList: (req, res) => res.status(200).json({ route: "getUserList" }),
          getFullList: (req, res) => res.status(200).json({ route: "getFullList" }),
          getSingleProperty: (req, res) => res.status(200).json({ route: "getSingleProperty" }),
          showGFSImage: (req, res) => res.status(200).json({ route: "showGFSImage" }),
          markAsSold: (req, res) => res.status(200).json({ route: "markAsSold" }),
          filterProperties: (req, res) => res.status(200).json({ route: "filterProperties" }),
        },
        multer: multerStub,
        mongoose: {
          connection: {
            once: () => {},
          },
          mongo: {
            GridFsStorage: function GridFsStorage() {},
          },
        },
      }
    );

    await withServer(propertyRouter, async (baseUrl) => {
      const anonymousMarkSold = await fetch(`${baseUrl}/markAsSold/example-slug`, {
        method: "POST",
      });
      assert.strictEqual(anonymousMarkSold.status, 401);

      const adminMarkSold = await fetch(`${baseUrl}/markAsSold/example-slug`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${createToken({ isAdmin: true })}`,
        },
      });
      assert.strictEqual(adminMarkSold.status, 200);
      assert.deepStrictEqual(await adminMarkSold.json(), {
        route: "markAsSold",
      });

      const anonymousCreate = await fetch(`${baseUrl}/new`, {
        method: "POST",
      });
      assert.strictEqual(anonymousCreate.status, 401);

      const authenticatedCreate = await fetch(`${baseUrl}/new`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${createToken()}`,
        },
      });
      assert.strictEqual(authenticatedCreate.status, 200);
      assert.deepStrictEqual(await authenticatedCreate.json(), {
        route: "addNewProperty",
      });
    });
  });
});
