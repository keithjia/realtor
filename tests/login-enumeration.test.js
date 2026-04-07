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
  }
});

describe('login enumeration regressions', () => {
  it('returns the same response when the account does not exist', async () => {
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
                return Promise.resolve(null);
              }
            };
          }
        }
      }
    );

    const res = createResponseRecorder();
    await authController.userLogin(
      { body: { emailPhone: 'missing@example.com', password: 'verystrongpass' } },
      res
    );

    assert.strictEqual(res.statusCode, 401);
    assert.deepStrictEqual(res.payload, {
      message: 'Invalid credentials'
    });
  });

  it('returns the same response when the password is wrong', async () => {
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
                return Promise.resolve({
                  _id: 'user-1',
                  password: 'hashed-password',
                  fname: 'Keith',
                  lname: 'Jia',
                  email: 'user@example.com',
                  isAdmin: false,
                });
              }
            };
          }
        },
        bcryptjs: {
          compare() {
            return Promise.resolve(false);
          }
        }
      }
    );

    const res = createResponseRecorder();
    await authController.userLogin(
      { body: { emailPhone: 'user@example.com', password: 'wrong-password' } },
      res
    );

    assert.strictEqual(res.statusCode, 401);
    assert.deepStrictEqual(res.payload, {
      message: 'Invalid credentials'
    });
  });
});
