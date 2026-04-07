const assert = require("assert");
const { createProvider, deployContract, getWallets } = require("./helpers/solidity");

describe("solidity contract test infrastructure", () => {
  it("compiles and deploys factory/home transaction contracts on an in-memory chain", async () => {
    const provider = createProvider();
    const [realtor, seller, buyer] = await getWallets(provider);

    const factory = await deployContract({
      fileName: "Factory.sol",
      contractName: "Factory",
      signer: realtor,
    });

    const sellerAddress = await seller.getAddress();
    const buyerAddress = await buyer.getAddress();

    const createTx = await factory.create(
      "123 Main St",
      "94105",
      "San Francisco",
      5,
      100,
      sellerAddress,
      buyerAddress
    );
    await createTx.wait();

    assert.strictEqual((await factory.getInstanceCount()).toString(), "1");

    const instanceAddress = await factory.getInstance(0);
    assert.ok(instanceAddress);
    assert.notStrictEqual(instanceAddress, "0x0000000000000000000000000000000000000000");
  });
});
