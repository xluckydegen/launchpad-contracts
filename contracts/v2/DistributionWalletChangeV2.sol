// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { BehaviorEmergencyWithdraw } from "../v2Behaviors/BehaviorEmergencyWithdraw.sol";

error DistributionWalletChange_InvalidData(string msg);
error DistributionWalletChange_DataAlreadyExists(string msg);
error DistributionWalletChange_DataNotExists();
error DistributionWalletChange_AddressAlreadyRedirected();

struct WalletChangeData {
    string uuid;
    uint256 createdAt;
    uint256 updatedAt;
    uint256 deletedAt;
    address walletFrom;
    address walletTo;
    string signature;
    string message;
}

interface IDistributionWalletChange {
    function storeWalletChange(WalletChangeData memory walletChange) external;

    function removeWalletChange(string memory uuid) external;

    function translateAddressToSourceAddress(address wallet) external view returns (address);
}

/**
 * @title Distribution Wallet Change
 * @author luckydegen
 */
contract DistributionWalletChange is
    IDistributionWalletChange,
    AccessControl,
    BehaviorEmergencyWithdraw
{
    //data
    mapping(string => WalletChangeData) public walletChanges;
    mapping(address => address) public walletChangesFromTo; // former old address (the original one, now invalid) to the new one
    mapping(address => address) public walletChangesToFrom; // the new address to the original one

    //events
    event WalletChanged(address wallet); // change to event WalletChanged(address from, address to) to improve readability?

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Store wallet change
     * @param walletChange The data containing the wallet change
     * @dev Signature and message are not being used now
     */
    function storeWalletChange(
        WalletChangeData memory walletChange
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        // NOTE neither signature nor message are being checked
        if (bytes(walletChange.uuid).length == 0) {
            revert DistributionWalletChange_InvalidData("IWU");
        } // Invalid Wallet Uuid
        if (walletChange.walletFrom == address(0)) {
            revert DistributionWalletChange_InvalidData("IWF");
        } // Invalid Wallet From
        if (walletChange.walletTo == address(0)) {
            revert DistributionWalletChange_InvalidData("IWT");
        } // Invalid Wallet To
        if (walletChange.walletFrom == walletChange.walletTo) {
            revert DistributionWalletChange_InvalidData("IWFT");
        } // Invalid Wallet From and To
        if (walletChange.deletedAt != 0) {
            revert DistributionWalletChange_InvalidData("IDD");
        } // Invalid Delete Date

        if (walletChange.createdAt == 0) {
            walletChange.createdAt = block.timestamp;
        }
        walletChange.updatedAt = block.timestamp;

        WalletChangeData memory walletChangeStored = walletChanges[walletChange.uuid];
        if (walletChangeStored.createdAt != 0 && walletChangeStored.deletedAt == 0) {
            revert DistributionWalletChange_DataAlreadyExists("UUID");
        } // Data already exists
        if (walletChangesFromTo[walletChange.walletFrom] != address(0)) {
            revert DistributionWalletChange_DataAlreadyExists("DWF");
        } // Wallet from already exists in map
        if (walletChangesToFrom[walletChange.walletTo] != address(0)) {
            revert DistributionWalletChange_DataAlreadyExists("DWT");
        } // Wallet to already exists in map

        walletChanges[walletChange.uuid] = walletChange;
        walletChangesFromTo[walletChange.walletFrom] = walletChange.walletTo;
        walletChangesToFrom[walletChange.walletTo] = walletChange.walletFrom;

        emit WalletChanged(walletChange.walletFrom);
    }

    /**
     * @notice Remove wallet change
     * @param uuid The uuid of the wallet change
     */
    function removeWalletChange(string memory uuid) public onlyRole(DEFAULT_ADMIN_ROLE) {
        WalletChangeData memory walletChangeStored = walletChanges[uuid];
        if (walletChangeStored.createdAt == 0) {
            revert DistributionWalletChange_DataNotExists();
        }
        if (walletChangeStored.deletedAt != 0) {
            revert DistributionWalletChange_DataNotExists();
        }

        walletChangesFromTo[walletChangeStored.walletFrom] = address(0);
        walletChangesToFrom[walletChangeStored.walletTo] = address(0);
        walletChangeStored.deletedAt = block.timestamp;
        walletChanges[walletChangeStored.uuid] = walletChangeStored;

        emit WalletChanged(walletChangeStored.walletFrom);
    }

    /**
     * @notice Translate address to source address
     * @param wallet The wallet address which is making the transaction (ie claim)
     */
    function translateAddressToSourceAddress(address wallet) external view returns (address) {
        //if input address is already redirected address, disable the next run
        if (walletChangesFromTo[wallet] != address(0)) {
            revert DistributionWalletChange_AddressAlreadyRedirected();
        }

        //if address is target address, return source address
        if (walletChangesToFrom[wallet] != address(0)) {
            return walletChangesToFrom[wallet];
        }

        //if address is not in maps, return as is
        return wallet;
    }

    /////////////
    // GETTERS //
    /////////////

    /**
     * @notice Get wallet change
     * @param uuid The uuid of the wallet change
     * @dev Returns the data containing the wallet change
     */
    function getWalletChange(string memory uuid) public view returns (WalletChangeData memory) {
        return walletChanges[uuid];
    }

    /**
     * @notice Get the address of the new wallet
     * @param originalWallet The original address (i.e., address which was redirected from)
     * @dev Returns the new address (i.e., address which was redirected to)
     */
    function getWalletFromTo(address originalWallet) public view returns (address) {
        return walletChangesFromTo[originalWallet];
    }

    /**
     * @notice Get the address of the new wallet
     * @param newWallet The new address (i.e., address which was redirected to)
     * @dev Returns the original address (i.e., address which was redirected from)
     */
    function getWalletToFrom(address newWallet) public view returns (address) {
        return walletChangesToFrom[newWallet];
    }
}
