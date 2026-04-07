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

describe('logging hygiene regressions', () => {
  it('does not emit raw console logs for handled property upload failures', async () => {
    let logCalls = 0;
    const originalLog = console.log;

    console.log = () => {
      logCalls += 1;
    };

    function PropertyStub() {
      this.save = async () => {
        throw new Error('save should not run');
      };
    }

    const propertyController = loadModuleWithStubs(
      path.resolve(__dirname, '../server/controllers/property.controller.js'),
      {
        '../providers/helper': {
          ...require('../server/providers/helper'),
          slugGenerator: async () => 'safe-slug',
        },
        '../models/propertyTypes': {},
        '../models/property': PropertyStub,
        mongoose: {
          connection: {
            on: () => {},
          },
          mongo: {},
        },
        'gridfs-stream': () => ({}),
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
    };

    await propertyController.addNewProperty(
      {
        user: { _id: 'user-1' },
        gfs: null,
        files: [{ originalname: 'house.png' }],
        body: {
          title: 'Unsafe Upload',
          Proptype: 'type-1',
          isSociety: false,
        },
      },
      res
    );

    console.log = originalLog;

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(logCalls, 0);
  });
});
