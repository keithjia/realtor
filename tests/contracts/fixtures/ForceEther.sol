pragma solidity >=0.4.25 <0.6.0;

contract ForceEther {
    constructor() public payable {}

    function destroyAndSend(address payable recipient) external {
        selfdestruct(recipient);
    }
}
