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

    //////////
    // USER //
    //////////

    // Invariant: Users cannot claim more tokens than maxAmount
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

    // Invariant: User cannot claim when paused
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

    // Invariant: User cannot claim more tokens proportionally to tokensDistributable
    function testUserCannotClaimMoreTokenProportionallyToTokensDistributable() public {
        // TODO
    }

    //////////////////
    // DISTRIBUTION //
    //////////////////

    // Invariant: The 'tokensDistributable' must always be less than or equal to 'tokensTotal' for any distribution.
    function testTokensDistributableLessThanOrEqualToTokensTotal() public view {
        DistributionData memory _data = _getCurrentDistribution();
        assert(_data.tokensDistributable <= _data.tokensTotal);
    }

    // Invariant: The sum of all claimed tokens by individual wallets should never exceed the 'tokensDistributable' in a given distribution.
    function testClaimedTokensNeverExceedTokensDistributable() public view {
        DistributionData memory _data = _getCurrentDistribution();
        uint256 totalAmountClaimed;
        for (uint8 i; i < _usersCounter; i++) {
            totalAmountClaimed += _getAmountClaimedByUser(i);
        }
        assert(totalAmountClaimed <= _data.tokensDistributable);
    }

    // Invariant: The sum of all claimed tokens by individual wallets should never exceed the 'tokensTotal' in a given distribution.
    function testClaimedTokensNeverExceedTokensTotal() public view {
        DistributionData memory _data = _getCurrentDistribution();
        uint256 totalAmountClaimed;
        for (uint8 i; i < _usersCounter; i++) {
            totalAmountClaimed += _getAmountClaimedByUser(i);
        }
        assert(totalAmountClaimed <= _data.tokensTotal);
    }
}
