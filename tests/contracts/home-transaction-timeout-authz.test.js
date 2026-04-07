const assert = require("assert");
const { ethers } = require("ethers");
const { createProvider, deployContract, getWallets } = require("./helpers/solidity");

describe("HomeTransaction timeout authorization regressions", () => {
  it("does not allow unrelated third parties to force rejection after the deadline", async () => {
    const provider = createProvider();
    const [realtor, seller, buyer, outsider] = await getWallets(provider);

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

    await (await contract.connect(seller).sellerSignContract()).wait();
    await (
      await contract
        .connect(buyer)
        .buyerSignContractAndPayDeposit({ value: ethers.BigNumber.from(10) })
    ).wait();
    await (await contract.connect(realtor).realtorReviewedClosingConditions(true)).wait();

    await provider.send("evm_increaseTime", [5 * 60 + 1]);
    await provider.send("evm_mine", []);

    await assert.rejects(
      contract.connect(outsider).anyWithdrawFromTransaction(),
      /participant/i
    );
  });
});
