// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

contract EmergencyWithdraw is Ownable {
    /**
     * @dev Function to reclaim all ERC20Recovery compatible tokens
     * Validates that the caller is the owner
     * @param _tokenAddress address The address of the token contract
     */
    function emergencyTokenWithdraw(address _tokenAddress) external onlyOwner {
        require(_tokenAddress != address(0), "token can't be 0x0");
        IERC20 token = IERC20(_tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        require(token.transfer(owner(), balance), "reclaim token failed");
    }

    /**
     * @dev Function to reclaim all ETH
     * Validates that the caller is the owner
     */
    function emergencyEthWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool sent,) = address(msg.sender).call{value: balance}("");
        require(sent, "Failed to send Ether");
    }
}
