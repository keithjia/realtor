const assert = require("assert");
const { ethers } = require("ethers");
const { createProvider, deployContract, getWallets } = require("./helpers/solidity");

describe("HomeTransaction seller signature payment regressions", () => {
  it("rejects ETH sent to sellerSignContract so funds cannot be trapped off-accounting", async () => {
    const provider = createProvider();
    const [realtor, seller, buyer] = await getWallets(provider);

    const contract = await deployContract({
      fileName: "HomeTransaction.sol",
      contractName: "HomeTransaction",
      signer: realtor,
      args: [
        "123 Main St",
        "94105",
        "San Francisco",
        5,
        100,
        await realtor.getAddress(),
        await seller.getAddress(),
        await buyer.getAddress(),
      ],
    });

    await assert.rejects(
      contract.connect(seller).sellerSignContract({ value: ethers.BigNumber.from(1) }),
      /non-payable|revert|cannot override value/i
    );
  });
});
