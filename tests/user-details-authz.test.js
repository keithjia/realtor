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
        _id: "user-1",
        email: "user@example.com",
        isAdmin: false,
        ...overrides,
      },
    },
    secretKey,
    {
      issuer: jwtIssuer,
      audience: jwtAudience,
      expiresIn: jwtExpiresIn,
      algorithm: "HS256",
      subject: String(overrides._id || "user-1"),
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

describe("user details authorization regressions", () => {
  it("rejects anonymous requests and non-owner access, while allowing self and admin access", async () => {
    const usersRouter = loadModuleWithStubs(
      path.resolve(__dirname, "../server/routes/users.js"),
      {
        "../controllers/users.controller": {
          getUserDetails: (req, res) => {
            if (!req.user.isAdmin && String(req.user._id) !== String(req.params.userId)) {
              return res.status(403).json({ message: "Not authorized to access this user" });
            }

            return res.status(200).json({ userId: req.params.userId });
          },
        },
      }
    );

    await withServer(usersRouter, async (baseUrl) => {
      const anonymousResponse = await fetch(`${baseUrl}/user-1`);
      assert.strictEqual(anonymousResponse.status, 401);
      assert.deepStrictEqual(await anonymousResponse.json(), {
        message: "Authentication required",
      });

      const forbiddenResponse = await fetch(`${baseUrl}/user-2`, {
        headers: {
          Authorization: `Bearer ${createToken({ _id: "user-1" })}`,
        },
      });
      assert.strictEqual(forbiddenResponse.status, 403);
      assert.deepStrictEqual(await forbiddenResponse.json(), {
        message: "Not authorized to access this user",
      });

      const selfResponse = await fetch(`${baseUrl}/user-1`, {
        headers: {
          Authorization: `Bearer ${createToken({ _id: "user-1" })}`,
        },
      });
      assert.strictEqual(selfResponse.status, 200);
      assert.deepStrictEqual(await selfResponse.json(), { userId: "user-1" });

      const adminResponse = await fetch(`${baseUrl}/user-2`, {
        headers: {
          Authorization: `Bearer ${createToken({ _id: "admin-1", isAdmin: true })}`,
        },
      });
      assert.strictEqual(adminResponse.status, 200);
      assert.deepStrictEqual(await adminResponse.json(), { userId: "user-2" });
    });
  });

  it("does not query the database for forbidden cross-user access", async () => {
    let findOneCalled = false;

    const usersController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/users.controller.js"),
      {
        "../models/users": {
          findOne() {
            findOneCalled = true;
            throw new Error("findOne should not be called for forbidden requests");
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
      send(body) {
        this.payload = body;
        return this;
      },
    };

    await usersController.getUserDetails(
      {
        user: { _id: "user-1", isAdmin: false },
        params: { userId: "user-2" },
      },
      res
    );

    assert.strictEqual(res.statusCode, 403);
    assert.deepStrictEqual(res.payload, {
      message: "Not authorized to access this user",
    });
    assert.strictEqual(findOneCalled, false);
  });
});
