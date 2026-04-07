const assert = require("assert");
const { ethers } = require("ethers");
const { createProvider, deployContract, getWallets } = require("./helpers/solidity");

describe("Factory pagination regressions", () => {
  it("supports paginated instance reads and bounds the legacy unbounded getter", async () => {
    const provider = createProvider();
    const [realtor, seller, buyer] = await getWallets(provider);

    const factory = await deployContract({
      fileName: "Factory.sol",
      contractName: "Factory",
      signer: realtor,
    });

    const sellerAddress = await seller.getAddress();
    const buyerAddress = await buyer.getAddress();

    for (let index = 0; index < 21; index += 1) {
      const tx = await factory.create(
        `123 Main St #${index}`,
        "94105",
        "San Francisco",
        5,
        100,
        sellerAddress,
        buyerAddress
      );
      await tx.wait();
    }

    try {
      await factory.getInstances();
      assert.fail("Expected getInstances to revert once the array exceeds the safe batch size");
    } catch (error) {
      const revertData = error && error.error && error.error.data;
      const decodedReason = ethers.utils.defaultAbiCoder.decode(
        ["string"],
        `0x${revertData.slice(10)}`
      )[0];
      assert.match(decodedReason, /too many instances|pagination/i);
    }

    const page = await factory.getInstancesPage(20, 10);
    assert.strictEqual(page.length, 1);
    assert.ok(page[0]);
  });
});
