const assert = require("assert");
const jwt = require("jsonwebtoken");
const Module = require("module");
const path = require("path");

const loadFreshModule = (modulePath) => {
  const resolvedModulePath = path.resolve(modulePath);
  delete require.cache[resolvedModulePath];
  return require(resolvedModulePath);
};

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

describe("jwt security regressions", () => {
  it("loads the JWT secret from environment configuration", () => {
    const configPath = path.resolve(__dirname, "../server/config/config.js");
    const originalSecret = process.env.JWT_SECRET;

    process.env.JWT_SECRET = "env-only-secret";
    delete require.cache[configPath];

    const config = require(configPath);

    assert.strictEqual(config.secretKey, "env-only-secret");

    process.env.JWT_SECRET = originalSecret;
    delete require.cache[configPath];
  });

  it("signs login tokens with expiry, issuer, audience, algorithm, and subject", async () => {
    const signCalls = [];
    const authController = loadModuleWithStubs(
      path.resolve(__dirname, "../server/controllers/auth.controller.js"),
      {
        jsonwebtoken: {
          sign(payload, secret, options) {
            signCalls.push({ payload, secret, options });
            return "signed-token";
          },
        },
        "../models/users": {
          findOne() {
            return {
              where() {
                return this;
              },
              select() {
                return Promise.resolve({
                  _id: "507f1f77bcf86cd799439011",
                  fname: "Keith",
                  lname: "Jia",
                  email: "keith@example.com",
                  isAdmin: true,
                  password: "hashed-password",
                });
              },
            };
          },
        },
        bcryptjs: {
          compare() {
            return Promise.resolve(true);
          },
        },
      }
    );

    const req = {
      body: {
        emailPhone: "keith@example.com",
        password: "plain-text-password",
      },
    };
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };

    await authController.userLogin(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(signCalls.length, 1);
    assert.strictEqual(signCalls[0].secret, process.env.JWT_SECRET);
    assert.deepStrictEqual(signCalls[0].options, {
      expiresIn: process.env.JWT_EXPIRES_IN,
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
      algorithm: "HS256",
      subject: "507f1f77bcf86cd799439011",
    });
    assert.strictEqual(signCalls[0].payload.user.email, "keith@example.com");
    assert.deepStrictEqual(res.body, {
      message: "Login Successful",
      token: "signed-token",
    });
  });

  it("requires valid issuer and audience claims when authenticating", () => {
    const authMiddleware = loadFreshModule(
      path.resolve(__dirname, "../server/middleware/auth.js")
    );

    const validReq = {
      headers: {
        authorization: `Bearer ${jwt.sign(
          { user: { _id: "u1", isAdmin: false } },
          process.env.JWT_SECRET,
          {
            issuer: process.env.JWT_ISSUER,
            audience: process.env.JWT_AUDIENCE,
            expiresIn: process.env.JWT_EXPIRES_IN,
            algorithm: "HS256",
            subject: "u1",
          }
        )}`,
      },
    };
    let validNextCalled = false;

    authMiddleware.requireAuth(validReq, createJsonResponseRecorder(), () => {
      validNextCalled = true;
    });

    assert.strictEqual(validNextCalled, true);
    assert.deepStrictEqual(validReq.user, { _id: "u1", isAdmin: false });

    const invalidIssuerReq = {
      headers: {
        authorization: `Bearer ${jwt.sign(
          { user: { _id: "u2", isAdmin: false } },
          process.env.JWT_SECRET,
          {
            issuer: "unexpected-issuer",
            audience: process.env.JWT_AUDIENCE,
            expiresIn: process.env.JWT_EXPIRES_IN,
            algorithm: "HS256",
            subject: "u2",
          }
        )}`,
      },
    };
    const invalidIssuerRes = createJsonResponseRecorder();
    let invalidIssuerNextCalled = false;

    authMiddleware.requireAuth(invalidIssuerReq, invalidIssuerRes, () => {
      invalidIssuerNextCalled = true;
    });

    assert.strictEqual(invalidIssuerNextCalled, false);
    assert.strictEqual(invalidIssuerRes.statusCode, 401);
    assert.deepStrictEqual(invalidIssuerRes.payload, { message: "Invalid token" });

    const invalidAudienceReq = {
      headers: {
        authorization: `Bearer ${jwt.sign(
          { user: { _id: "u3", isAdmin: false } },
          process.env.JWT_SECRET,
          {
            issuer: process.env.JWT_ISSUER,
            audience: "unexpected-audience",
            expiresIn: process.env.JWT_EXPIRES_IN,
            algorithm: "HS256",
            subject: "u3",
          }
        )}`,
      },
    };
    const invalidAudienceRes = createJsonResponseRecorder();

    authMiddleware.requireAuth(invalidAudienceReq, invalidAudienceRes, () => {});

    assert.strictEqual(invalidAudienceRes.statusCode, 401);
    assert.deepStrictEqual(invalidAudienceRes.payload, { message: "Invalid token" });
  });
});

function createJsonResponseRecorder() {
  return {
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
}
