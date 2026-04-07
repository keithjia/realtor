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

describe("email route authorization regressions", () => {
  it("rejects anonymous email submissions and allows authenticated requests", async () => {
    /*
     * Regression test for:
     *
     * High: the public email endpoint acted as an unauthenticated relay.
     * For this assessment, requiring authenticated access is the intended
     * control even though we are not wiring full anti-abuse integrations.
     */
    process.env.SENDGRID_API_KEY = "test-sendgrid-key";
    process.env.SENDGRID_TEMPLATE_ID = "template-123";

    let sendCalls = 0;
    let sentPayload = null;

    const emailRouter = loadModuleWithStubs(
      path.resolve(__dirname, "../server/routes/email.js"),
      {
        "@sendgrid/mail": {
          setApiKey() {},
          send(payload) {
            sendCalls += 1;
            sentPayload = payload;
            return Promise.resolve();
          },
        },
      }
    );

    await withServer(emailRouter, async (baseUrl) => {
      const anonymousResponse = await fetch(`${baseUrl}/github-pages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toEmail: "to@example.com",
          fromEmail: "from@example.com",
          name: "Keith",
          email: "from@example.com",
          message: "Hello",
        }),
      });
      assert.strictEqual(anonymousResponse.status, 401);
      assert.deepStrictEqual(await anonymousResponse.json(), {
        message: "Authentication required",
      });

      const authenticatedResponse = await fetch(`${baseUrl}/github-pages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${createToken()}`,
        },
        body: JSON.stringify({
          toEmail: "to@example.com",
          fromEmail: "from@example.com",
          name: "Keith",
          email: "from@example.com",
          message: "Hello",
        }),
      });
      assert.strictEqual(authenticatedResponse.status, 200);
      assert.deepStrictEqual(await authenticatedResponse.json(), {
        message: "Email sent successfully",
      });
    });

    assert.strictEqual(sendCalls, 1);
    assert.deepStrictEqual(sentPayload, {
      to: "to@example.com",
      from: "from@example.com",
      template_id: "template-123",
      dynamic_template_data: {
        name: "Keith",
        email: "from@example.com",
        message: "Hello",
      },
    });
  });
});
