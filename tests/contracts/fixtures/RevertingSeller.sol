pragma solidity >=0.4.25 <0.6.0;

interface IHomeTransactionSeller {
    function sellerSignContract() external payable;
}

contract RevertingSeller {
    function sign(address transactionAddress) external {
        IHomeTransactionSeller(transactionAddress).sellerSignContract();
    }

    function() external payable {
        revert("seller refuses direct payments");
    }
}
