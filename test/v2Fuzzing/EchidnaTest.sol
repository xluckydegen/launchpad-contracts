// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { PropertiesAsserts } from "./PropertiesHelpers.sol";
import { EchidnaHelpers } from "./EchidnaHelpers.sol";

/**
 * @title Fuzzing Campaign to test invariants
 */

contract EchidnaTest is EchidnaHelpers {
    uint256 s_number;

    function testDistributionCount() public view {
        assert(distribution.distributionsCount() == 0);
    }

    function increaseBy(uint256 num) public {
        s_number += num;
    }

    function testNumber() public view {
        assert(s_number == 0);
    }
}
