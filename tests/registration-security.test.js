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

describe('registration security regressions', () => {
  it('rejects missing required registration fields', async () => {
    const authController = loadModuleWithStubs(
      path.resolve(__dirname, '../server/controllers/auth.controller.js'),
      {
        '../models/users': function UserStub() {},
      }
    );

    const res = createResponseRecorder();
    await authController.userRegistration(
      { body: { email: 'user@example.com', password: 'verystrongpass' } },
      res
    );

    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(res.payload, {
      message: 'fname is required'
    });
  });

  it('rejects weak registration passwords', async () => {
    const authController = loadModuleWithStubs(
      path.resolve(__dirname, '../server/controllers/auth.controller.js'),
      {
        '../models/users': function UserStub() {},
      }
    );

    const res = createResponseRecorder();
    await authController.userRegistration(
      {
        body: {
          fname: 'Keith',
          lName: 'Jia',
          email: 'user@example.com',
          phoneNo: '1234567890',
          password: 'shortpass'
        }
      },
      res
    );

    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(res.payload, {
      message: 'Password must be at least 12 characters long'
    });
  });

  it('returns a sanitized conflict when duplicate user credentials exist', async () => {
    function UserStub() {
      this.save = async () => {
        const err = new Error('duplicate key');
        err.code = 11000;
        throw err;
      };
    }

    const authController = loadModuleWithStubs(
      path.resolve(__dirname, '../server/controllers/auth.controller.js'),
      {
        '../models/users': UserStub,
        bcryptjs: {
          hash() {
            return Promise.resolve('hashed:verystrongpass');
          }
        }
      }
    );

    const res = createResponseRecorder();
    await authController.userRegistration(
      {
        body: {
          fname: 'Keith',
          lName: 'Jia',
          email: 'user@example.com',
          phoneNo: '1234567890',
          password: 'verystrongpass'
        }
      },
      res
    );

    assert.strictEqual(res.statusCode, 409);
    assert.deepStrictEqual(res.payload, {
      message: 'A user with those credentials already exists'
    });
  });

  it('still allows valid registrations', async () => {
    let savedPassword = null;

    function UserStub() {
      this.save = async () => {
        savedPassword = this.password;
        return { _id: 'user-1' };
      };
    }

    const authController = loadModuleWithStubs(
      path.resolve(__dirname, '../server/controllers/auth.controller.js'),
      {
        '../models/users': UserStub,
        bcryptjs: {
          hash(password) {
            return Promise.resolve(`hashed:${password}`);
          }
        }
      }
    );

    const res = createResponseRecorder();
    await authController.userRegistration(
      {
        body: {
          fname: 'Keith',
          lName: 'Jia',
          email: 'user@example.com',
          phoneNo: '1234567890',
          password: 'verystrongpass'
        }
      },
      res
    );

    assert.strictEqual(savedPassword, 'hashed:verystrongpass');
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.payload, {
      message: 'User Added Successfully',
      id: 'user-1'
    });
  });
});
