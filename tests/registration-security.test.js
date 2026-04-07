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

  it('rejects malformed email and phone values', async () => {
    const authController = loadModuleWithStubs(
      path.resolve(__dirname, '../server/controllers/auth.controller.js'),
      {
        '../models/users': function UserStub() {},
      }
    );

    const invalidEmailResponse = createResponseRecorder();
    await authController.userRegistration(
      {
        body: {
          fname: 'Keith',
          lName: 'Jia',
          email: 'not-an-email',
          phoneNo: '1234567890',
          password: 'verystrongpass'
        }
      },
      invalidEmailResponse
    );

    assert.strictEqual(invalidEmailResponse.statusCode, 400);
    assert.deepStrictEqual(invalidEmailResponse.payload, {
      message: 'email is invalid'
    });

    const invalidPhoneResponse = createResponseRecorder();
    await authController.userRegistration(
      {
        body: {
          fname: 'Keith',
          lName: 'Jia',
          email: 'user@example.com',
          phoneNo: 'abc',
          password: 'verystrongpass'
        }
      },
      invalidPhoneResponse
    );

    assert.strictEqual(invalidPhoneResponse.statusCode, 400);
    assert.deepStrictEqual(invalidPhoneResponse.payload, {
      message: 'phoneNo is invalid'
    });
  });

  it('normalizes email, phone, and name fields before saving', async () => {
    let savedUser = null;

    function UserStub() {
      this.save = async () => {
        savedUser = {
          fname: this.fname,
          lname: this.lname,
          email: this.email,
          phoneNo: this.phoneNo,
          password: this.password
        };
        return { _id: 'user-2' };
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
          fname: '  Keith  ',
          lName: "  O'Jia  ",
          email: '  USER@Example.COM ',
          phoneNo: '(123) 456-7890',
          password: 'verystrongpass'
        }
      },
      res
    );

    assert.deepStrictEqual(savedUser, {
      fname: 'Keith',
      lname: "O'Jia",
      email: 'user@example.com',
      phoneNo: '1234567890',
      password: 'hashed:verystrongpass'
    });
    assert.strictEqual(res.statusCode, 200);
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
