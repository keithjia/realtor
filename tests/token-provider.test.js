const assert = require('assert');
const Module = require('module');
const path = require('path');

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

describe('token provider regressions', () => {
  it('does not sign or log tokens on module import', () => {
    /*
     * Regression test for:
     *
     * High: token.provider.js executed crypto-related code at module load,
     * attempted to sign a token immediately, and logged the result. In a
     * funds-moving environment that is unacceptable even if the file is not
     * currently imported anywhere.
     *
     * This test locks in that importing the provider performs no signing and
     * no console side effects. Upstream callers must explicitly initialize
     * and invoke the provider API.
     */
    let signCalls = 0;
    let logCalls = 0;
    const originalLog = console.log;

    console.log = () => {
      logCalls += 1;
    };

    loadModuleWithStubs(
      path.resolve(__dirname, '../server/providers/token.provider.js'),
      {
        jsonwebtoken: {
          sign() {
            signCalls += 1;
            return 'token';
          }
        }
      }
    );

    console.log = originalLog;

    assert.strictEqual(signCalls, 0);
    assert.strictEqual(logCalls, 0);
  });

  it('requires explicit init before signing tokens', () => {
    const tokenProvider = loadFreshModule(
      path.resolve(__dirname, '../server/providers/token.provider.js')
    );

    assert.throws(() => {
      tokenProvider.signToken({ foo: 'bar' });
    }, /not been initialized/);
  });

  it('signs tokens only after explicit initialization', () => {
    let signArgs = null;

    const tokenProvider = loadModuleWithStubs(
      path.resolve(__dirname, '../server/providers/token.provider.js'),
      {
        jsonwebtoken: {
          sign(payload, secret, options) {
            signArgs = { payload, secret, options };
            return 'signed-token';
          }
        }
      }
    );

    tokenProvider.init({ secretKey: 'test-secret', algorithm: 'HS256' });
    const token = tokenProvider.signToken(
      { sub: 'user-1' },
      { expiresIn: '1h' }
    );

    assert.strictEqual(token, 'signed-token');
    assert.deepStrictEqual(signArgs, {
      payload: { sub: 'user-1' },
      secret: 'test-secret',
      options: {
        algorithm: 'HS256',
        expiresIn: '1h'
      }
    });
  });
});
