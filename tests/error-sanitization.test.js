const assert = require('assert');
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

const createResponseRecorder = () => ({
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
  }
});

describe('error sanitization regressions', () => {
  it('does not leak raw login errors to clients', async () => {
    const authController = loadModuleWithStubs(
      path.resolve(__dirname, '../server/controllers/auth.controller.js'),
      {
        '../models/users': {
          findOne() {
            return {
              where() {
                return this;
              },
              select() {
                throw new Error('database exploded');
              }
            };
          }
        }
      }
    );

    const res = createResponseRecorder();
    await authController.userLogin({ body: { emailPhone: 'a@b.com', password: 'pw' } }, res);

    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(res.payload, {
      message: 'Unable to process login request'
    });
  });

  it('does not leak raw user detail lookup errors to clients', async () => {
    const usersController = loadModuleWithStubs(
      path.resolve(__dirname, '../server/controllers/users.controller.js'),
      {
        '../models/users': {
          findOne() {
            const chain = {
              select() {
                return this;
              },
              populate() {
                return this;
              },
              then(resolve, reject) {
                return Promise.reject(new Error('query failed')).then(resolve, reject);
              }
            };

            return chain;
          }
        }
      }
    );

    const res = createResponseRecorder();
    await usersController.getUserDetails(
      { user: { _id: 'u1', isAdmin: true }, params: { userId: 'u2' } },
      res
    );

    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(res.payload, {
      message: 'Unable to fetch user details'
    });
  });

  it('does not leak provider errors from the email route', async () => {
    process.env.SENDGRID_API_KEY = 'test-sendgrid-key';
    process.env.SENDGRID_TEMPLATE_ID = 'template-123';

    const express = require('express');
    const jwt = require('jsonwebtoken');
    const config = require('../server/config/config');

    const emailRouter = loadModuleWithStubs(
      path.resolve(__dirname, '../server/routes/email.js'),
      {
        '@sendgrid/mail': {
          setApiKey() {},
          send() {
            return Promise.reject(new Error('provider failed hard'));
          }
        }
      }
    );

    const app = express();
    app.use(express.json());
    app.use(emailRouter);

    const server = await new Promise((resolve) => {
      const instance = app.listen(0, () => resolve(instance));
    });

    const token = jwt.sign(
      { user: { _id: 'u1', isAdmin: true } },
      config.secretKey,
      {
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
        expiresIn: config.jwtExpiresIn,
        algorithm: 'HS256',
        subject: 'u1'
      }
    );

    const response = await fetch(`http://127.0.0.1:${server.address().port}/github-pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        toEmail: 'to@example.com',
        fromEmail: 'from@example.com',
        name: 'Keith',
        email: 'from@example.com',
        message: 'Hello'
      })
    });

    const payload = await response.json();

    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    assert.strictEqual(response.status, 400);
    assert.deepStrictEqual(payload, {
      message: 'Unable to send email'
    });
  });
});
