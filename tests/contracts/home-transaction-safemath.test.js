const assert = require("assert");
const { ethers } = require("ethers");
const { createProvider, deployContract, getWallets } = require("./helpers/solidity");

describe("HomeTransaction arithmetic safety regressions", () => {
  it("rejects deployments that would overflow the minimum deposit calculation", async () => {
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
          0,
          ethers.constants.MaxUint256,
          await realtor.getAddress(),
          await seller.getAddress(),
          await buyer.getAddress(),
        ],
      }),
      /multiplication overflow/i
    );
  });
});
