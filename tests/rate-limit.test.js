const assert = require('assert');
const express = require('express');
const Module = require('module');
const path = require('path');

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
  app.use((req, res, next) => {
    req.ip = '127.0.0.1';
    next();
  });
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

describe('rate limiting regressions', () => {
  it('throttles repeated login attempts', async () => {
    const authRouter = loadModuleWithStubs(
      path.resolve(__dirname, '../server/routes/auth.js'),
      {
        '../controllers/auth.controller': {
          userLogin: (req, res) => res.status(401).json({ message: 'Invalid credentials' }),
          userRegistration: (req, res) => res.status(200).json({ route: 'register' }),
          userList: (req, res) => res.status(200).json({ route: 'userList' }),
          changePass: (req, res) => res.status(200).json({ route: 'changePass' }),
        },
      }
    );

    await withServer(authRouter, async (baseUrl) => {
      for (let i = 0; i < 5; i += 1) {
        const response = await fetch(`${baseUrl}/user/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailPhone: 'user@example.com', password: 'wrongpass' }),
        });
        assert.strictEqual(response.status, 401);
      }

      const throttledResponse = await fetch(`${baseUrl}/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailPhone: 'user@example.com', password: 'wrongpass' }),
      });

      assert.strictEqual(throttledResponse.status, 429);
      assert.deepStrictEqual(await throttledResponse.json(), {
        message: 'Too many authentication requests',
      });
    });
  });

  it('throttles repeated email relay attempts after admin authorization', async () => {
    const emailRouter = loadModuleWithStubs(
      path.resolve(__dirname, '../server/routes/email.js'),
      {
        '../middleware/auth': {
          requireAdmin: (req, res, next) => {
            req.user = { _id: 'admin-1', isAdmin: true };
            next();
          }
        },
        '@sendgrid/mail': {
          setApiKey() {},
          send() {
            return Promise.resolve();
          }
        }
      }
    );

    await withServer(emailRouter, async (baseUrl) => {
      for (let i = 0; i < 3; i += 1) {
        const response = await fetch(`${baseUrl}/github-pages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmail: 'to@example.com',
            fromEmail: 'from@example.com',
            name: 'Keith',
            email: 'from@example.com',
            message: 'Hello',
          }),
        });
        assert.strictEqual(response.status, 200);
      }

      const throttledResponse = await fetch(`${baseUrl}/github-pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: 'to@example.com',
          fromEmail: 'from@example.com',
          name: 'Keith',
          email: 'from@example.com',
          message: 'Hello',
        }),
      });

      assert.strictEqual(throttledResponse.status, 429);
      assert.deepStrictEqual(await throttledResponse.json(), {
        message: 'Too many email requests',
      });
    });
  });
});
