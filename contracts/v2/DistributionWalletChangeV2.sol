// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "../v2Behaviors/BehaviorEmergencyWithdraw.sol";

error DistributionWalletChange_InvalidData(string msg);
error DistributionWalletChange_DataAlreadyExists(string msg);
error DistributionWalletChange_DataNotExists();
error DistributionWalletChange_AddressAlreadyRedirected();

struct WalletChangeData {
    string uuid;
    uint createdAt;
    uint updatedAt;
    uint deletedAt;
    address walletFrom;
    address walletTo;
    string signature;
    string message;
}

interface IDistributionWalletChange {
    function storeWalletChange(WalletChangeData memory walletChange) external;

    function removeWalletChange(string memory uuid) external;

    function translateAddressToSourceAddress(
        address wallet
    ) external view returns (address);
}

contract DistributionWalletChange is
    IDistributionWalletChange,
    AccessControl,
    BehaviorEmergencyWithdraw
{
    //data
    mapping(string => WalletChangeData) public walletChanges;
    mapping(address => address) public walletChangesFromTo; // former old address (the original one, now invalid)
    mapping(address => address) public walletChangesToFrom; // new address to redirect funds to

    //events
    event WalletChanged(address wallet); // change to event WalletChanged(address from, address to) to improve readability?

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function storeWalletChange(
        WalletChangeData memory walletChange
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        // NOTE neither signature nor message are being checked 
        if (bytes(walletChange.uuid).length == 0)
            revert DistributionWalletChange_InvalidData("IWU"); // Invalid Wallet Uuid
        if (walletChange.walletFrom == address(0))
            revert DistributionWalletChange_InvalidData("IWF"); // Invalid Wallet From
        if (walletChange.walletTo == address(0))
            revert DistributionWalletChange_InvalidData("IWT"); // Invalid Wallet To
        if (walletChange.walletFrom == walletChange.walletTo)
            revert DistributionWalletChange_InvalidData("IWFT"); // Invalid Wallet From and To
        if (walletChange.createdAt == 0)
            walletChange.createdAt = block.timestamp;
        walletChange.updatedAt = block.timestamp;

        WalletChangeData memory walletChangeStored = walletChanges[
            walletChange.uuid
        ];
        if (
            walletChangeStored.createdAt != 0 &&
            walletChangeStored.deletedAt == 0
        ) revert DistributionWalletChange_DataAlreadyExists("UUID"); // why UUID?
        if (walletChangesFromTo[walletChange.walletFrom] != address(0))
            revert DistributionWalletChange_DataAlreadyExists("DWF"); // DWF?
        if (walletChangesToFrom[walletChange.walletTo] != address(0))
            revert DistributionWalletChange_DataAlreadyExists("DWT"); // DWT?

        walletChanges[walletChange.uuid] = walletChange;
        walletChangesFromTo[walletChange.walletFrom] = walletChange.walletTo;
        walletChangesToFrom[walletChange.walletTo] = walletChange.walletFrom;

        emit WalletChanged(walletChange.walletFrom);
    }

    function removeWalletChange(
        string memory uuid
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        WalletChangeData memory walletChangeStored = walletChanges[uuid];
        if (walletChangeStored.createdAt == 0)
            revert DistributionWalletChange_DataNotExists();
        if (walletChangeStored.deletedAt != 0)
            revert DistributionWalletChange_DataNotExists();

        walletChangesFromTo[walletChangeStored.walletFrom] = address(0);
        walletChangesToFrom[walletChangeStored.walletTo] = address(0);
        walletChangeStored.deletedAt = block.timestamp;
        walletChanges[walletChangeStored.uuid] = walletChangeStored;

        emit WalletChanged(walletChangeStored.walletFrom);
    }

    function translateAddressToSourceAddress(
        address wallet
    ) external view returns (address) {
        //if input address is already redirected address, disable the next run
        if (walletChangesFromTo[wallet] != address(0))
            revert DistributionWalletChange_AddressAlreadyRedirected();

        //if address is target address, return source address
        if (walletChangesToFrom[wallet] != address(0))
            return walletChangesToFrom[wallet];

        //if address is not in maps, return as is
        return wallet;
    }
}
