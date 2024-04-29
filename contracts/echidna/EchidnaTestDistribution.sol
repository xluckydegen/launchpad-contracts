// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { Distribution, DistributionData, IERC20 } from "contracts/v2/DistributionV2.sol";
import { DistributionWalletChange } from "contracts/v2/DistributionWalletChangeV2.sol";
import { EchidnaHelpers } from "./EchidnaHelpers.sol";
import { PropertiesAsserts } from "./PropertiesHelpers.sol";
import { Debugger } from "./Debugger.sol";

error EchidnaTestDistribution_NoTokenSet();

/**
 * @title Fuzzing Campaign to test invariants
 */
contract EchidnaTestDistribution is EchidnaHelpers {
    constructor() {}

    /////////////////////////////////
    // Claims and Claiming Process //
    /////////////////////////////////

    // 1.1. Users cannot claim more tokens than their `maxAmount`
    function usersCannotClaimMoreTokensThanMaxAmount() public {
        DistributionData memory _data = _getCurrentDistribution();
        string memory _uuid = _data.uuid;
        bytes32 _merkleRoot = _data.merkleRoot;
        for (uint8 i; i < _usersCounter; i++) {
            address userAddress = users[i].userAddress;
            uint256 userMaxAmountByMerkle = getUsersMaxAmountByMerkleRoot(_merkleRoot, userAddress);
            uint256 userAmountClaimed = distribution.getWalletClaims(_uuid, userAddress);
            Debugger.log("userAddress", userAddress);
            Debugger.log("userAmountClaimed", userAmountClaimed);
            Debugger.log("userMaxAmountByMerkle", userMaxAmountByMerkle);
            assert(userAmountClaimed <= userMaxAmountByMerkle);
        }
        assert(true);
    }

    // 1.2. User cannot claim if `enabled` flag in `DistributionData` is set to `true`.
    function userCannotClaimWhenPaused(uint8 _userId) public {
        hevm.prank(OWNER);
        distribution.emergencyDistributionsPause(true);

        DistributionData memory _data = _getCurrentDistribution();

        address _userAddress = getUserAddress(_userId);
        bytes32 _merkleRoot = _data.merkleRoot;
        uint256 _userMaxAmount = getUsersMaxAmountByMerkleRoot(_merkleRoot, _userAddress);
        bytes32[] memory _userProof = getUserProof(_userId, _merkleRoot);
        hevm.prank(_userAddress);
        try distribution.claim(distributionUuid, _userMaxAmount, _userProof) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    // 1.3. User cannot claim more tokens proportionally to `tokensDistributable`
    function userCannotClaimMoreTokenProportionallyToTokensDistributable() public {
        // TODO
    }

    // 1.4. User's token balance must always increase after successful claim.
    // 2.4. Distribution contract balance of the claiming tokens must not decrease less that amount claimed.
    function userBalanceMustIncreaseAfterSuccessfulClaim(uint8 _userId) public {
        DistributionData memory _data = _getCurrentDistribution();
        if (address(_data.token) == address(0)) revert EchidnaTestDistribution_NoTokenSet();
        IERC20 _token = IERC20(_data.token);
        address _userAddress = getUserAddress(_userId);
        uint256 _userMaxAmount = getUsersMaxAmountByMerkleRoot(_data.merkleRoot, _userAddress);
        bytes32[] memory _userProof = getUserProof(_userId, _data.merkleRoot);
        uint256 _userBalanceBefore = _token.balanceOf(_userAddress);
        uint256 _contractBalanceBefore = _token.balanceOf(address(distribution));
        hevm.prank(_userAddress);
        try distribution.claim(_data.uuid, _userMaxAmount, _userProof) {
            uint256 _userBalanceAfter = _token.balanceOf(_userAddress);
            uint256 _contractBalanceAfter = _token.balanceOf(address(distribution));
            Debugger.log("_userAddress", _userAddress);
            Debugger.log("_userMaxAmount", _userMaxAmount);
            Debugger.log("_userBalanceBefore", _userBalanceBefore);
            Debugger.log("_userBalanceAfter", _userBalanceAfter);
            Debugger.log("_contractBalanceBefore", _contractBalanceBefore);
            Debugger.log("_contractBalanceAfter", _contractBalanceAfter);
            assert(_userBalanceAfter > _userBalanceBefore);
            assert(_contractBalanceAfter < _contractBalanceBefore);
            uint256 claimedAmount = _userBalanceAfter - _userBalanceBefore;
            assert(_contractBalanceBefore - claimedAmount == _contractBalanceAfter);
        } catch {
            assert(true);
        }
    }

    ////////////////////////////////////////
    // Token and Distribution Consistency //
    ////////////////////////////////////////

    // 2.1. The 'tokensDistributable' must always be less than or equal to 'tokensTotal' for any distribution.
    function tokensDistributableLessThanOrEqualToTokensTotal() public view {
        DistributionData memory _data = _getCurrentDistribution();
        assert(_data.tokensDistributable <= _data.tokensTotal);
    }

    // 2.2. The sum of all claimed tokens by individual wallets should never exceed the 'tokensDistributable' in a given distribution.
    function claimedTokensNeverExceedTokensDistributable() public view {
        DistributionData memory _data = _getCurrentDistribution();
        uint256 totalAmountClaimed;
        for (uint8 i; i < _usersCounter; i++) {
            totalAmountClaimed += _getAmountClaimedByUser(i);
        }
        assert(totalAmountClaimed <= _data.tokensDistributable);
    }

    // 2.3. The sum of all claimed tokens by individual wallets should never exceed the 'tokensTotal' in a given distribution.
    function claimedTokensNeverExceedTokensTotal() public view {
        DistributionData memory _data = _getCurrentDistribution();
        uint256 totalAmountClaimed;
        for (uint8 i; i < _usersCounter; i++) {
            totalAmountClaimed += _getAmountClaimedByUser(i);
        }
        assert(totalAmountClaimed <= _data.tokensTotal);
    }
}
