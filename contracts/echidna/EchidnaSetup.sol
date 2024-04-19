// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IHevm} from "./IHevm.sol";
import {EchidnaConfig} from "./EchidnaConfig.sol";
// import { Distribution } from "contracts/v2/DistributionV2.sol";
// import { DistributionWalletChange } from "contracts/v2/DistributionWalletChangeV2.sol";

/**
 * @title Mixin for fuzzing setup and a smart contract deployment
 */
contract EchidnaSetup is EchidnaConfig {
    IHevm public hevm = IHevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    // Distribution public distribution;
    // DistributionWalletChange public distributionWalletChange;

    constructor() {
        // distributionWalletChange = new DistributionWalletChange();
        // distribution = new Distribution(distributionWalletChange);
    }
}
