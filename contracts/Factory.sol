pragma solidity >=0.4.25 <0.6.0;

import "./HomeTransaction.sol";

contract Factory {
  uint constant MAX_INSTANCE_BATCH = 20;
  HomeTransaction[] contracts;

  event HomeTransactionCreated(address indexed creator, address indexed instance, uint index);

  function create(
        string memory _address,
        string memory _zip,
        string memory _city,
        uint _realtorFee,
        uint _price,
        address payable _seller,
        address payable _buyer) public returns(HomeTransaction homeTransaction)  {
    require(_seller != address(0) && _buyer != address(0), "Role address cannot be zero");
    require(msg.sender != _seller && msg.sender != _buyer && _seller != _buyer, "Roles must be distinct");

    homeTransaction = new HomeTransaction(
      _address,
      _zip,
      _city,
      _realtorFee,
      _price,
      msg.sender,
      _seller,
      _buyer);
    contracts.push(homeTransaction);
    emit HomeTransactionCreated(msg.sender, address(homeTransaction), contracts.length - 1);
  }

  function getInstance(uint index) public view returns (HomeTransaction instance) {
    require(index < contracts.length, "index out of range");

    instance = contracts[index];
  }

  function getInstances() public view returns (HomeTransaction[] memory instances) {
    require(contracts.length <= MAX_INSTANCE_BATCH, "Too many instances for unbounded read; use pagination");
    instances = contracts;
  }

  function getInstancesPage(uint start, uint count) public view returns (HomeTransaction[] memory instances) {
    require(start <= contracts.length, "start out of range");
    require(count <= MAX_INSTANCE_BATCH, "Page size too large");

    uint end = start + count;
    if (end > contracts.length) {
      end = contracts.length;
    }

    instances = new HomeTransaction[](end - start);

    for (uint index = start; index < end; index++) {
      instances[index - start] = contracts[index];
    }
  }

  function getInstanceCount() public view returns (uint count) {
    count = contracts.length;
  }
}
