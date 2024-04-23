// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { Distribution } from "contracts/v2/DistributionV2.sol";
import { DistributionWalletChange } from "contracts/v2/DistributionWalletChangeV2.sol";
import { EchidnaMerkleHelpers } from "./EchidnaMerkleHelpers.sol";
import { PropertiesAsserts } from "./PropertiesHelpers.sol";

/**
 * @title Fuzzing Campaign to test invariants
 */
contract EchidnaTestDistribution is EchidnaMerkleHelpers {
    Distribution public distribution;
    DistributionWalletChange public distributionWalletChange;

    constructor() EchidnaMerkleHelpers(OWNER, OWNER) {}
}
