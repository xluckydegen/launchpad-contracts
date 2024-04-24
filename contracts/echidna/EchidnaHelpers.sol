// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { Distribution, DistributionData } from "contracts/v2/DistributionV2.sol";
import { DistributionWalletChange } from "contracts/v2/DistributionWalletChangeV2.sol";
import { EchidnaMerkleHelpers } from "./EchidnaMerkleHelpers.sol";
import { PropertiesAsserts } from "./PropertiesHelpers.sol";

/**
 * @title Helpers of distribution contract
 */
contract EchidnaHelpers is EchidnaMerkleHelpers {
    Distribution public distribution;
    DistributionWalletChange public distributionWalletChange;

    constructor() EchidnaMerkleHelpers(OWNER, OWNER) {
        // deploy contracts on behalf of the owner
        hevm.prank(OWNER);
        distributionWalletChange = new DistributionWalletChange();
        hevm.prank(OWNER);
        distribution = new Distribution(distributionWalletChange);
    }

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

    function _getCurrentDistribution() internal view returns (DistributionData memory) {
        return distribution.getDistributionData(distributionUuid);
    }

    function _getAmountClaimedByUser(uint8 _userId) internal view returns (uint256) {
        address userAddress = getUserAddress(_userId);
        return distribution.getWalletClaims(distributionUuid, userAddress);
    }
}
