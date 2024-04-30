// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { Distribution, DistributionData, IERC20 } from "contracts/v2/DistributionV2.sol";
import { DistributionWalletChange } from "contracts/v2/DistributionWalletChangeV2.sol";
import { EchidnaHelpers } from "./EchidnaHelpers.sol";
import { PropertiesAsserts } from "./PropertiesHelpers.sol";
import { Debugger } from "./Debugger.sol";

error EchidnaTestDistribution_NoTokenSet();
error EchidnaTestDistribution_Paused();

/**
 * @title Fuzzing Campaign to test invariants
 */
contract EchidnaTestDistribution is EchidnaHelpers {
    constructor() {}

    /////////////////////////////////
    // Claims and Claiming Process //
    /////////////////////////////////

    // 1.1. Users cannot claim more tokens than `maxAmount`
    // -> invariant check via accounting
    function usersCannotClaimMoreTokensThanMaxAmount() public {
        DistributionData memory _data = getCurrentDistribution();
        string memory _uuid = _data.uuid;
        uint256 alreadyClaimedAmount = distribution.getAlreadyClaimed(_uuid);
        if (alreadyClaimedAmount > 0) {
            bytes32 _merkleRoot = _data.merkleRoot;
            for (uint8 i; i < _usersCounter; i++) {
                address userAddress = users[i].userAddress;
                uint256 userMaxAmountByMerkle = getUsersMaxAmountByMerkleRoot(
                    _merkleRoot,
                    userAddress
                );
                uint256 userAmountClaimed = distribution.getWalletClaims(_uuid, userAddress);

                Debugger.log("userAddress", userAddress);
                Debugger.log("userAmountClaimed", userAmountClaimed);
                Debugger.log("userMaxAmountByMerkle", userMaxAmountByMerkle);

                assert(userAmountClaimed <= userMaxAmountByMerkle);
            }
        }
    }

    // 1.1. User cannot claim more tokens than their `maxAmount`
    // -> invariant check via function call
    function userCannotClaimIfAlreadyClaimedMaxAmount(uint8 _userId) public {
        DistributionData memory _data = getCurrentDistribution();
        if (address(_data.token) == address(0)) revert EchidnaTestDistribution_NoTokenSet();
        if (_data.enabled == false) revert EchidnaTestDistribution_Paused();

        IERC20 _token = _data.token;
        address _userAddress = getUserAddress(_userId);
        uint256 _userMaxAmount = getUsersMaxAmountByMerkleRoot(_data.merkleRoot, _userAddress);
        bytes32[] memory _userProof = getUserProof(_userId, _data.merkleRoot);

        uint256 _contractBalanceBefore = _token.balanceOf(address(distribution));
        uint256 alreadyClaimed = distribution.getWalletClaims(_data.uuid, _userAddress);

        if (_contractBalanceBefore == 0 || alreadyClaimed == _userMaxAmount) {
            // claim is supposed to revert as either nothing to be claimed (no tokens)
            // or user has already claimed all tokens
            hevm.prank(_userAddress);
            try distribution.claim(_data.uuid, _userMaxAmount, _userProof) {
                assert(false);
            } catch {
                assert(true);
            }
        }
    }

    // 1.2. User cannot claim if `enabled` flag in `DistributionData` is set to `true`.
    function userCannotClaimWhenPaused(uint8 _userId) public {
        distribution.emergencyDistributionsPause(true);
        DistributionData memory _data = getCurrentDistribution();

        address _userAddress = getUserAddress(_userId);
        uint256 _userMaxAmount = getUsersMaxAmountByMerkleRoot(_data.merkleRoot, _userAddress);
        bytes32[] memory _userProof = getUserProof(_userId, _data.merkleRoot);

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
    // 1.5. Distribution's token balance must always decrease after successful claim.
    // 2.4. Distribution contract balance of the claiming tokens must not decrease less that amount claimed.
    function userBalanceMustIncreaseAfterSuccessfulClaim(uint8 _userId) public {
        DistributionData memory _data = getCurrentDistribution();
        // data validation
        if (address(_data.token) == address(0)) revert EchidnaTestDistribution_NoTokenSet();
        if (_data.enabled == false) revert EchidnaTestDistribution_Paused();
        // token
        IERC20 _token = _data.token;
        // user
        address _userAddress = getUserAddress(_userId);
        uint256 _userMaxAmount = getUsersMaxAmountByMerkleRoot(_data.merkleRoot, _userAddress);
        bytes32[] memory _userProof = getUserProof(_userId, _data.merkleRoot);
        // balances
        uint256 _userBalanceBefore = _token.balanceOf(_userAddress);
        uint256 _contractBalanceBefore = _token.balanceOf(address(distribution));
        uint256 _alreadyClaimedByUser = distribution.getWalletClaims(_data.uuid, _userAddress);

        if (_alreadyClaimedByUser < _userMaxAmount) {
            if (_contractBalanceBefore == 0) {
                // mint tokens to have always something to be claimed
                uint256 alreadyDeposited = distribution.getAlreadyDeposited(_data.uuid);
                // uint256 tokensTotal = _data.tokensTotal;
                uint256 tokensToMint = _data.tokensTotal > alreadyDeposited
                    ? _data.tokensTotal - alreadyDeposited
                    : 0;
                // user has not minted all tokens yet, thus `tokensToMint` must be always positive
                assert(tokensToMint > 0);
                depositTokensToDistribution(tokensToMint);
                _contractBalanceBefore = _token.balanceOf(address(distribution));
                assert(_contractBalanceBefore > 0);
            }
            Debugger.log("_token.address", address(_token));
            Debugger.log("_contractBalanceBefore", _contractBalanceBefore);

            hevm.prank(_userAddress);
            distribution.claim(_data.uuid, _userMaxAmount, _userProof);

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
            assert(claimedAmount <= _userMaxAmount);
        }
    }

    ////////////////////////////////////////
    // Token and Distribution Consistency //
    ////////////////////////////////////////

    // 2.1. The 'tokensDistributable' must always be less than or equal to 'tokensTotal' for any distribution.
    // 2.2. The sum of all claimed tokens by individual wallets should never exceed the 'tokensDistributable' in a given distribution.
    // 2.3. The sum of all claimed tokens by individual wallets should never exceed the 'tokensTotal' in a given distribution.
    // 2.4. The sum of all claimed tokens by individual wallets must be equal to 'distributionClaimed[uuid]' in a given distribution.
    function claimedTokensNeverExceedTokensDistributable() public {
        DistributionData memory _data = getCurrentDistribution();
        uint256 alreadyClaimedTotal = distribution.getAlreadyClaimed(_data.uuid);
        // sum all claimed tokens by users
        uint256 totalAmountClaimed;
        for (uint8 i; i < _usersCounter; i++) {
            totalAmountClaimed += _getAmountClaimedByUser(i);
        }
        Debugger.log("_data.tokensDistributable", _data.tokensDistributable);
        Debugger.log("_data.tokensTotal", _data.tokensTotal);
        Debugger.log("totalAmountClaimed", totalAmountClaimed);
        Debugger.log("alreadyClaimedTotal", alreadyClaimedTotal);

        assert(_data.tokensDistributable <= _data.tokensTotal);
        assert(totalAmountClaimed <= _data.tokensDistributable);
        assert(totalAmountClaimed <= _data.tokensTotal);
        assert(totalAmountClaimed == alreadyClaimedTotal);
    }
}
