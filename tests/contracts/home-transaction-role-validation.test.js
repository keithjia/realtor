const assert = require("assert");
const { ethers } = require("ethers");
const { createProvider, deployContract, getWallets } = require("./helpers/solidity");

describe("HomeTransaction role validation regressions", () => {
  it("rejects zero-address and duplicate-role deployments", async () => {
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
          5,
          100,
          ethers.constants.AddressZero,
          await seller.getAddress(),
          await buyer.getAddress(),
        ],
      }),
      /role address cannot be zero/i
    );

    const sellerAddress = await seller.getAddress();

    await assert.rejects(
      deployContract({
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
          sellerAddress,
          sellerAddress,
        ],
      }),
      /roles must be distinct/i
    );
  });

  it("rejects unsafe role combinations when creating contracts through the factory", async () => {
    const provider = createProvider();
    const [realtor, seller] = await getWallets(provider);

    const factory = await deployContract({
      fileName: "Factory.sol",
      contractName: "Factory",
      signer: realtor,
    });

    await assert.rejects(
      factory.create(
        "123 Main St",
        "94105",
        "San Francisco",
        5,
        100,
        await seller.getAddress(),
        await seller.getAddress()
      ),
      /roles must be distinct/i
    );
  });
});
