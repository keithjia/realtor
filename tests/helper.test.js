const assert = require("assert");

const helpers = require("../server/providers/helper");

describe("helper provider", () => {
  describe("isKeyMissing", () => {
    it("returns the first missing required key", () => {
      const result = helpers.isKeyMissing(
        { email: "user@example.com" },
        ["email", "password", "phoneNo"]
      );

      assert.strictEqual(result, "password");
    });

    it("returns false when all required keys exist", () => {
      const result = helpers.isKeyMissing(
        { email: "user@example.com", password: "secret" },
        ["email", "password"]
      );

      assert.strictEqual(result, false);
    });
  });
});
