const assert = require("assert");
const express = require("express");
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

const withServer = async (app, runAssertions) => {
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

describe("app bootstrap regressions", () => {
  it("parses JSON and urlencoded request bodies before routing", async () => {
    /*
     * Regression test for:
     *
     * High: the API did not initialize request body parsing, so core write
     * flows relying on req.body could fail at runtime.
     *
     * This test verifies both JSON and application/x-www-form-urlencoded
     * bodies are populated before downstream routes execute.
     */
    const stubRouter = express.Router();
    stubRouter.post("/echo", (req, res) => {
      res.status(200).json({ body: req.body });
    });

    const { createApp } = loadModuleWithStubs(
      path.resolve(__dirname, "../server/app.js"),
      {
        "./routes/users": express.Router(),
        "./routes/auth": express.Router(),
        "./routes/common": express.Router(),
        "./routes/property": express.Router(),
        "./routes/email": stubRouter,
      }
    );

    const app = createApp();

    await withServer(app, async (baseUrl) => {
      const jsonResponse = await fetch(`${baseUrl}/api/email/echo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "json@example.com" }),
      });
      assert.strictEqual(jsonResponse.status, 200);
      assert.deepStrictEqual(await jsonResponse.json(), {
        body: { email: "json@example.com" },
      });

      const urlEncodedResponse = await fetch(`${baseUrl}/api/email/echo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "email=form%40example.com&name=Keith",
      });
      assert.strictEqual(urlEncodedResponse.status, 200);
      assert.deepStrictEqual(await urlEncodedResponse.json(), {
        body: { email: "form@example.com", name: "Keith" },
      });
    });
  });

  it("connects to Mongo before starting the HTTP server", async () => {
    let connectUrl = null;
    let listenInvoked = false;
    let closeInvoked = false;

    const { startServer } = loadModuleWithStubs(
      path.resolve(__dirname, "../server/app.js"),
      {
        "./config/config": {
          secretKey: "0123456789abcdef0123456789abcdef",
          localDB: "mongodb://localhost/realestatedb",
        },
        mongoose: {
          connect: async (url) => {
            connectUrl = url;
          },
        },
        http: {
          createServer() {
            return {
              listen(port, callback) {
                listenInvoked = true;
                callback();
              },
              close(callback) {
                closeInvoked = true;
                if (callback) {
                  callback();
                }
              },
            };
          },
        },
        "./routes/users": express.Router(),
        "./routes/auth": express.Router(),
        "./routes/common": express.Router(),
        "./routes/property": express.Router(),
        "./routes/email": express.Router(),
      }
    );

    const { server } = await startServer({ port: 5050 });

    assert.strictEqual(
      connectUrl,
      require("../server/config/config").localDB
    );
    assert.strictEqual(listenInvoked, true);

    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    assert.strictEqual(closeInvoked, true);
  });

  it("fails fast when JWT_SECRET is missing or weak", () => {
    const appModulePath = path.resolve(__dirname, "../server/app.js");

    const missingSecretModule = loadModuleWithStubs(appModulePath, {
      "./config/config": {
        secretKey: "",
        localDB: "mongodb://localhost/testdb",
      },
      "./routes/users": express.Router(),
      "./routes/auth": express.Router(),
      "./routes/common": express.Router(),
      "./routes/property": express.Router(),
      "./routes/email": express.Router(),
    });

    assert.throws(() => {
      missingSecretModule.validateRuntimeConfig();
    }, /JWT_SECRET is required/);

    const weakSecretModule = loadModuleWithStubs(appModulePath, {
      "./config/config": {
        secretKey: "short-secret",
        localDB: "mongodb://localhost/testdb",
      },
      "./routes/users": express.Router(),
      "./routes/auth": express.Router(),
      "./routes/common": express.Router(),
      "./routes/property": express.Router(),
      "./routes/email": express.Router(),
    });

    assert.throws(() => {
      weakSecretModule.validateRuntimeConfig();
    }, /JWT_SECRET must be at least 32 characters long/);
  });
});
