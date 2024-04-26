// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { Distribution, DistributionData } from "contracts/v2/DistributionV2.sol";
import { DistributionWalletChange } from "contracts/v2/DistributionWalletChangeV2.sol";
import { EchidnaHelpers } from "./EchidnaHelpers.sol";
import { PropertiesAsserts } from "./PropertiesHelpers.sol";

/**
 * @title Fuzzing Campaign to test invariants
 */
contract EchidnaTestDistribution is EchidnaHelpers {
    constructor() {}

    /////////////////////////////////
    // Claims and Claiming Process //
    /////////////////////////////////

    // 1. Users cannot claim more tokens than their `maxAmount`
    function testUsersCannotClaimMoreTokensThanMaxAmount() public view {
        DistributionData memory _data = _getCurrentDistribution();
        string memory _uuid = _data.uuid;
        bytes32 _merkleRoot = _data.merkleRoot;
        for (uint8 i; i < _usersCounter; i++) {
            address userAddress = users[i].userAddress;
            uint256 userMaxAmountByMerkle = getUsersMaxAmountByMerkleRoot(_merkleRoot, userAddress);
            uint256 userAmountClaimed = distribution.getWalletClaims(_uuid, userAddress);
            assert(userAmountClaimed <= userMaxAmountByMerkle);
        }
        assert(true);
    }

    // 2. User cannot claim if `enabled` flag in `DistributionData` is set to `true`.
    function testUserCannotClaimWhenPaused(uint8 _userId) public {
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

    // 3. User cannot claim more tokens proportionally to `tokensDistributable`
    function testUserCannotClaimMoreTokenProportionallyToTokensDistributable() public {
        // TODO
    }

    // 4. User's token balance must always increase after successful claim.
    function testUserBalanceMustIncreaseAfterSuccessfulClaim(uint8 _userId) public {
        DistributionData memory _data = _getCurrentDistribution();
        MockERC20 _token = MockERC20(_data.token);
        address _userAddress = getUserAddress(_userId);
        uint256 _userMaxAmount = getUsersMaxAmountByMerkleRoot(_data.merkleRoot, _userAddress);
        bytes32[] memory _userProof = getUserProof(_userId, _data.merkleRoot);
        uint256 _userBalanceBefore = _token.balanceOf(_userAddress);
        hevm.prank(_userAddress);
        try distribution.claim(_data.uuid, _userMaxAmount, _userProof) {
            uint256 _userBalanceAfter = _token.balanceOf(_userAddress);
            assert (_userBalanceAfter > _userBalanceBefore);
        } catch {
            assert(true)
        }

    ////////////////////////////////////////
    // Token and Distribution Consistency //
    ////////////////////////////////////////

    // 1. The 'tokensDistributable' must always be less than or equal to 'tokensTotal' for any distribution.
    function testTokensDistributableLessThanOrEqualToTokensTotal() public view {
        DistributionData memory _data = _getCurrentDistribution();
        assert(_data.tokensDistributable <= _data.tokensTotal);
    }

    // 2. The sum of all claimed tokens by individual wallets should never exceed the 'tokensDistributable' in a given distribution.
    function testClaimedTokensNeverExceedTokensDistributable() public view {
        DistributionData memory _data = _getCurrentDistribution();
        uint256 totalAmountClaimed;
        for (uint8 i; i < _usersCounter; i++) {
            totalAmountClaimed += _getAmountClaimedByUser(i);
        }
        assert(totalAmountClaimed <= _data.tokensDistributable);
    }

    // 3. The sum of all claimed tokens by individual wallets should never exceed the 'tokensTotal' in a given distribution.
    function testClaimedTokensNeverExceedTokensTotal() public view {
        DistributionData memory _data = _getCurrentDistribution();
        uint256 totalAmountClaimed;
        for (uint8 i; i < _usersCounter; i++) {
            totalAmountClaimed += _getAmountClaimedByUser(i);
        }
        assert(totalAmountClaimed <= _data.tokensTotal);
    }


}
