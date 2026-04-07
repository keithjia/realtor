const assert = require("assert");

const { errorHandler, notFound } = require("../server/middleware/errorHandler");

describe("errorHandler middleware", () => {
  it("returns the error status and message as JSON", () => {
    const err = { status: 418, message: "teapot" };
    const res = {
      headersSent: false,
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      }
    };

    errorHandler(err, {}, res, () => {});

    assert.strictEqual(res.statusCode, 418);
    assert.deepStrictEqual(res.body, { message: "teapot" });
  });

  it("delegates to next when headers were already sent", () => {
    const err = new Error("already sent");
    let nextArg;
    const res = {
      headersSent: true
    };

    errorHandler(err, {}, res, (value) => {
      nextArg = value;
    });

    assert.strictEqual(nextArg, err);
  });
});

describe("notFound middleware", () => {
  it("creates a 404 error and passes it to next", () => {
    let nextArg;

    notFound({}, {}, (value) => {
      nextArg = value;
    });

    assert.strictEqual(nextArg.status, 404);
    assert.strictEqual(nextArg.message, "Route Not Found");
  });
});
