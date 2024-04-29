// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { Distribution, DistributionData } from "contracts/v2/DistributionV2.sol";
import {
    DistributionWalletChange,
    WalletChangeData
} from "contracts/v2/DistributionWalletChangeV2.sol";
import { EchidnaMerkleHelpers } from "./EchidnaMerkleHelpers.sol";
import { PropertiesLibString } from "./PropertiesHelpers.sol";

error EchidnaHelpers__FromEqualsTo();
error EchidnaHelpers__NoWalletChanges();

/**
 * @title Helpers of distribution contract
 */
contract EchidnaHelpers is EchidnaMerkleHelpers {
    Distribution public distribution;
    DistributionWalletChange public distributionWalletChange;

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR");
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    string[] public walletChangesUuids;

    event Debug(address from, address to);

    constructor() EchidnaMerkleHelpers(OWNER, OWNER) {
        // deploy contracts on behalf of the owner
        hevm.prank(OWNER);
        distributionWalletChange = new DistributionWalletChange();
        hevm.prank(OWNER);
        distribution = new Distribution(distributionWalletChange);
    }

    //////////////////////////
    // Distribution helpers //
    //////////////////////////

    function storeDistribution() public {
        hevm.prank(OWNER);
        distribution.storeDistribution(currentDistributionData);
    }

    function depositTokensToDistribution(uint256 _amount) public {
        // get current distribution stored
        DistributionData memory distributionData = _getCurrentDistribution();
        string memory distributionUuid = distributionData.uuid;
        // mint tokens to distributor to be sure depositor has enough tokens
        mintTokenToDistributor(_currentTokenId, _amount);

        hevm.prank(OWNER);
        distribution.depositTokensToDistribution(distributionUuid, _amount);
    }

    function claim(uint8 _userId) public {
        // distribution
        DistributionData memory currentDistribution = _getCurrentDistribution();
        // user
        address userAddress = getUserAddress(_userId);
        uint256 userMaxAmount = getUserMaxAmount(_userId);
        bytes32[] memory userProof = getUserProof(_userId, currentDistribution.merkleRoot);
        // claim
        hevm.prank(userAddress);
        distribution.claim(currentDistribution.uuid, userMaxAmount, userProof);
    }

    function pauseDistributions(bool _paused) public {
        hevm.prank(OWNER);
        distribution.emergencyDistributionsPause(_paused);
    }

    //////////////////////////////////////
    // DistributionWalletChange helpers //
    //////////////////////////////////////

    function storeWalletChange(uint8 _userIdFrom, uint8 _userIdTo) public {
        WalletChangeData memory _data = createWalletChangeData(_userIdFrom, _userIdTo);
        hevm.prank(OWNER);
        distributionWalletChange.storeWalletChange(_data);
    }

    function removeWalletChange(uint256 _num) public {
        uint256 _totalChanges = getWalletChangeCount();
        if (_totalChanges == 0) revert EchidnaHelpers__NoWalletChanges();
        uint256 num = _num % _totalChanges;
        string memory _walletChangeUuid = walletChangesUuids[num];
        hevm.prank(OWNER);
        distributionWalletChange.removeWalletChange(_walletChangeUuid);
    }

    function createWalletChangeData(
        uint8 _userIdFrom,
        uint8 _userIdTo
    ) public returns (WalletChangeData memory) {
        address _from = getUserAccount(_userIdFrom);
        // TODO check if 'from' address exists in merkle tree, otherwise revert?
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
    ) external view returns (WalletChangeData memory) {
        return distributionWalletChange.getWalletChange(walletChangeUuid);
    }

    function getWalletFromTo(address _from) external view returns (address _to) {
        return distributionWalletChange.getWalletFromTo(_from);
    }

    function getWalletToFrom(address _to) external view returns (address _from) {
        return distributionWalletChange.getWalletToFrom(_to);
    }

    function _getCurrentDistribution() internal view returns (DistributionData memory) {
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
