const assert = require("assert");
const { createProvider, deployContract, getWallets } = require("./helpers/solidity");

describe("HomeTransaction realtor fee bound regressions", () => {
  it("rejects deployments where the minimum buyer deposit could be smaller than the realtor fee", async () => {
    const provider = createProvider();
    const [realtor, seller, buyer] = await getWallets(provider);

    await assert.rejects(
      deployContract({
        fileName: "HomeTransaction.sol",
        contractName: "HomeTransaction",
        signer: realtor,
        args: [
          "123 Main St",
          "94105",
          "San Francisco",
          11,
          100,
          await realtor.getAddress(),
          await seller.getAddress(),
          await buyer.getAddress(),
        ],
      }),
      /minimum buyer deposit/i
    );
  });
});
