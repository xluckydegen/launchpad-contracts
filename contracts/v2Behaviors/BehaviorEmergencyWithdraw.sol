// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";

/**
 * @title Emergency contract
 * @author luckydegen
 */
contract BehaviorEmergencyWithdraw is AccessControl {
    /**
     * @notice Function to reclaim all ERC20Recovery compatible tokens
     * @param _tokenAddress address The address of the token contract
     * @dev Validates that the caller has admin role
     */
    function emergencyTokenWithdraw(address _tokenAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_tokenAddress != address(0), "token can't be 0x0");
        IERC20 token = IERC20(_tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        require(token.transfer(msg.sender, balance), "reclaim token failed");
    }

    /**
     * @notice Function to reclaim all ETH
     * @dev Validates that the caller has admin role
     */
    function emergencyEthWithdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        (bool sent, ) = address(msg.sender).call{ value: balance }("");
        require(sent, "Failed to send Ether");
    }
}
