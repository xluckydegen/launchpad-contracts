// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "./BehaviorEmergencyWithdraw.sol";

contract TestEmergencyWithdraw is AccessControl, BehaviorEmergencyWithdraw {

   event ReceivedEth(uint256 amount);
   
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function fundme() public payable {
        emit ReceivedEth(msg.value);
    }

    receive() external payable {
        fundme();
    }

    fallback() external payable {
        fundme();
    }
}
