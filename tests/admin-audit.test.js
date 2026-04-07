const assert = require("assert");
const express = require("express");
const jwt = require("jsonwebtoken");
const Module = require("module");
const path = require("path");

const {
  secretKey,
  jwtIssuer,
  jwtAudience,
  jwtExpiresIn,
} = require("../server/config/config");

const createToken = (overrides = {}) =>
  jwt.sign(
    {
      user: {
        _id: "admin-1",
        email: "admin@example.com",
        isAdmin: true,
        ...overrides,
      },
    },
    secretKey,
    {
      issuer: jwtIssuer,
      audience: jwtAudience,
      expiresIn: jwtExpiresIn,
      algorithm: "HS256",
      subject: String(overrides._id || "admin-1"),
    }
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

describe("admin audit logging regressions", () => {
  it("logs successful admin route actions with a clear audit line", async () => {
    const captured = [];
    const originalInfo = console.info;
    console.info = (message) => captured.push(message);

    try {
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
            checkemailAvailability: (req, res) => res.status(200).json({ response: false }),
          },
        }
      );

      await withServer(commonRouter, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/state`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${createToken()}`,
          },
          body: JSON.stringify({ name: "CA" }),
        });

        assert.strictEqual(response.status, 200);
      });
    } finally {
      console.info = originalInfo;
    }

    assert.strictEqual(captured.length, 1);
    assert.ok(captured[0].includes("[AUDIT]"));
    assert.ok(captured[0].includes("action=admin.state.create"));
    assert.ok(captured[0].includes("adminId=admin-1"));
    assert.ok(captured[0].includes("status=200"));
  });
});
