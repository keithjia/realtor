const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const Module = require('module');
const path = require('path');

const {
  secretKey,
  jwtIssuer,
  jwtAudience,
  jwtExpiresIn,
} = require('../server/config/config');

const createToken = (overrides = {}) =>
  jwt.sign(
    {
      user: {
        _id: 'user-1',
        email: 'user@example.com',
        isAdmin: false,
        ...overrides,
      },
    },
    secretKey,
    {
      issuer: jwtIssuer,
      audience: jwtAudience,
      expiresIn: jwtExpiresIn,
      algorithm: 'HS256',
      subject: String(overrides._id || 'user-1'),
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

describe('email availability authorization regressions', () => {
  it('rejects anonymous and non-admin email enumeration while allowing admins', async () => {
    const commonRouter = loadModuleWithStubs(
      path.resolve(__dirname, '../server/routes/common.js'),
      {
        '../controllers/common.controller': {
          getStateList: (req, res) => res.status(200).json({ route: 'getStateList' }),
          addState: (req, res) => res.status(200).json({ route: 'addState' }),
          getAllCities: (req, res) => res.status(200).json({ route: 'getAllCities' }),
          addCity: (req, res) => res.status(200).json({ route: 'addCity' }),
          getCityList: (req, res) => res.status(200).json({ route: 'getCityList' }),
          removeCity: (req, res) => res.status(200).json({ route: 'removeCity' }),
          checkemailAvailability: (req, res) =>
            res.status(200).json({ response: true, email: req.params.email }),
        },
      }
    );

    await withServer(commonRouter, async (baseUrl) => {
      const anonymousResponse = await fetch(
        `${baseUrl}/checkemail-availability/email/test@example.com`
      );
      assert.strictEqual(anonymousResponse.status, 401);
      assert.deepStrictEqual(await anonymousResponse.json(), {
        message: 'Authentication required',
      });

      const authenticatedResponse = await fetch(
        `${baseUrl}/checkemail-availability/email/test@example.com`,
        {
          headers: {
            Authorization: `Bearer ${createToken()}`,
          },
        }
      );
      assert.strictEqual(authenticatedResponse.status, 403);
      assert.deepStrictEqual(await authenticatedResponse.json(), {
        message: 'Admin access required',
      });

      const adminResponse = await fetch(
        `${baseUrl}/checkemail-availability/email/test@example.com`,
        {
          headers: {
            Authorization: `Bearer ${createToken({ isAdmin: true, _id: 'admin-1' })}`,
          },
        }
      );
      assert.strictEqual(adminResponse.status, 200);
      assert.deepStrictEqual(await adminResponse.json(), {
        response: true,
        email: 'test@example.com',
      });
    });
  });
});
