// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { IHevm } from "./IHevm.sol";
import { EchidnaConfig } from "./EchidnaConfig.sol";

/**
 * @title Mixin for fuzzing setup and a smart contract deployment
 */
contract EchidnaSetup is EchidnaConfig {
    IHevm public hevm = IHevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    constructor() {}
}
