// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {
    Distribution,
    DistributionData,
    DistributionImportRecord
} from "contracts/v2/DistributionV2.sol";
import {
    DistributionWalletChange,
    WalletChangeData
} from "contracts/v2/DistributionWalletChangeV2.sol";
import { EchidnaMerkleHelpers } from "./EchidnaMerkleHelpers.sol";
import { PropertiesLibString } from "./PropertiesHelpers.sol";
import { MockERC20 } from "./MockERC20.sol";
import { Debugger } from "./Debugger.sol";

error EchidnaHelpers__FromEqualsTo();
error EchidnaHelpers__NoWalletChanges();
error EchidnaHelpers__NoDistributionUuid();
error EchidnaHelpers__TooLowTokensDistributable();

/**
 * @title Helpers of distribution contract
 * @author 0xharold
 */
contract EchidnaHelpers is EchidnaMerkleHelpers {
    Distribution public distribution;
    DistributionWalletChange public distributionWalletChange;

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR");
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    string[] public walletChangesUuids;

    constructor() {
        distributionWalletChange = new DistributionWalletChange();
        distribution = new Distribution(distributionWalletChange);
    }

    //////////////////////////
    // Distribution helpers //
    //////////////////////////

    function storeDistribution() public {
        distribution.storeDistribution(currentDistributionData);
        // Debugging part (also to double-check if Echidna goes through this part)
        DistributionData memory currDistroData = getCurrentDistribution();
        Debugger.log("uuid", currDistroData.uuid);
        Debugger.log("address(token)", address(currDistroData.token));
        Debugger.log("tokensTotal", currDistroData.tokensTotal);
        Debugger.log("tokensDistributable", currDistroData.tokensDistributable);
        Debugger.log("merkleRoot", currDistroData.merkleRoot);
        Debugger.log("enabled", currDistroData.enabled);
    }

    function depositTokensToDistribution(uint256 amountToDeposit) public {
        // // rounding error
        // if (amountToDeposit <= MIN_DEPOSIT_AMOUNT) {
        //     revert EchidnaHelpers__TooLowAmount();
        // }
        // get current distribution stored
        DistributionData memory currDistroData = getCurrentDistribution();
        // validate uuid
        string memory currentDistributionUuid = currDistroData.uuid;
        if (bytes(currentDistributionUuid).length == 0) {
            revert EchidnaHelpers__NoDistributionUuid();
        }
        // validate `_amount`
        uint256 alreadyDeposited = distribution.getAlreadyDeposited(currentDistributionUuid);
        if (currDistroData.tokensDistributable < alreadyDeposited + amountToDeposit) {
            revert EchidnaHelpers__TooLowTokensDistributable();
        }
        // mint tokens to a distributor to be sure the depositor has enough tokens
        MockERC20(address(currDistroData.token)).mint(address(this), amountToDeposit);
        // approve token
        currDistroData.token.approve(address(distribution), amountToDeposit);
        uint256 distrBalanceBefore = currDistroData.token.balanceOf(address(distribution));
        // deposit token
        distribution.depositTokensToDistribution(currentDistributionUuid, amountToDeposit);
        uint256 distrBalanceAfter = currDistroData.token.balanceOf(address(distribution));

        Debugger.log("amountToDeposit", amountToDeposit);
        Debugger.log("distrBalanceBefore", distrBalanceBefore);
        Debugger.log("distrBalanceAfter", distrBalanceAfter);
    }

    function claim(uint8 _userId) public {
        // distribution
        DistributionData memory currentDistribution = getCurrentDistribution();
        // user
        address userAddress = getUserAddress(_userId);
        uint256 userMaxAmount = getUserMaxAmount(_userId);
        bytes32[] memory userProof = getUserProofByUserId(_userId, currentDistribution.merkleRoot);
        uint256 userBalanceBefore = currentDistribution.token.balanceOf(userAddress);
        // claim
        hevm.prank(userAddress);
        distribution.claim(currentDistribution.uuid, userMaxAmount, userProof);
        // debugging and logging
        uint256 userBalanceAfter = currentDistribution.token.balanceOf(userAddress);
        Debugger.log("userAddress", userAddress);
        Debugger.log("userMaxAmount", userMaxAmount);
        Debugger.log("userBalanceBefore", userBalanceBefore);
        Debugger.log("userBalanceAfter", userBalanceAfter);
    }

    function pauseDistributions(bool _paused) public {
        distribution.emergencyDistributionsPause(_paused);
        // debugging and logging
        DistributionData memory currDistroData = getCurrentDistribution();
        Debugger.log("_paused", _paused);
        Debugger.log("currDistroData.enabled", currDistroData.enabled);
    }

    //////////////////////////////////////
    // DistributionWalletChange helpers //
    //////////////////////////////////////

    function storeWalletChange(uint8 _userIdFrom, uint8 _userIdTo) public {
        WalletChangeData memory _data = createWalletChangeData(_userIdFrom, _userIdTo);
        distributionWalletChange.storeWalletChange(_data);

        // debugging and logging
        Debugger.log("_data.uuid", _data.uuid);
        Debugger.log("_data.walletFrom", _data.walletFrom);
        Debugger.log("_data.walletTo", _data.walletTo);

        address walletFromTo = getWalletFromTo(_data.walletFrom);
        address walletToTo = getWalletFromTo(_data.walletTo);
        Debugger.log("walletFromTo", walletFromTo);
        Debugger.log("walletToTo", walletToTo);
    }

    function removeWalletChange(uint256 _num) public {
        uint256 _totalChanges = getWalletChangeCount();
        if (_totalChanges == 0) revert EchidnaHelpers__NoWalletChanges();
        uint256 num = _num % _totalChanges;
        string memory _walletChangeUuid = walletChangesUuids[num];
        distributionWalletChange.removeWalletChange(_walletChangeUuid);

        // debugging and logging
        WalletChangeData memory _data = getWalletChange(_walletChangeUuid);
        address walletFromTo = getWalletFromTo(_data.walletFrom);
        address walletToTo = getWalletFromTo(_data.walletTo);
        Debugger.log("walletFromTo", walletFromTo);
        Debugger.log("walletToTo", walletToTo);
    }

    function createWalletChangeData(
        uint8 _userIdFrom,
        uint8 _userIdTo
    ) public returns (WalletChangeData memory) {
        address _from = getUserAccount(_userIdFrom);
        address _to = getUserAccount(_userIdTo);
        if (_from == _to) revert EchidnaHelpers__FromEqualsTo();
        string memory _walletChangeUuid = PropertiesLibString.toString(_from);
        WalletChangeData memory _dataToReturn = WalletChangeData({
            uuid: _walletChangeUuid,
            walletFrom: _from,
            walletTo: _to,
            createdAt: 0,
            updatedAt: 0,
            deletedAt: 0,
            signature: "",
            message: ""
        });
        walletChangesUuids.push(_walletChangeUuid);
        return _dataToReturn;
    }

    /////////////
    // GETTERS //
    /////////////

    function getWalletChangeCount() public view returns (uint256) {
        return walletChangesUuids.length;
    }

    function getWalletChange(
        string memory walletChangeUuid
    ) public view returns (WalletChangeData memory) {
        return distributionWalletChange.getWalletChange(walletChangeUuid);
    }

    function getWalletFromTo(address _from) public view returns (address _to) {
        return distributionWalletChange.getWalletFromTo(_from);
    }

    function getWalletToFrom(address _to) public view returns (address _from) {
        return distributionWalletChange.getWalletToFrom(_to);
    }

    function getCurrentDistribution() public view returns (DistributionData memory) {
        return distribution.getDistributionData(distributionUuid);
    }

    function _getAmountClaimedByUser(uint8 _userId) internal view returns (uint256) {
        address userAddress = getUserAddress(_userId);
        return distribution.getWalletClaims(distributionUuid, userAddress);
    }

    function hasAdminRole(address _account) external view returns (bool) {
        return distribution.hasRole(DEFAULT_ADMIN_ROLE, _account);
    }

    function hasDistributorRole(address _account) external view returns (bool) {
        return distribution.hasRole(DISTRIBUTOR_ROLE, _account);
    }
}
