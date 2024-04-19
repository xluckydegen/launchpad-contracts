// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { Test } from "forge-std/Test.sol";
import { CheatCodes } from "./Interface.sol";
import { Distribution, DistributionData } from "contracts/v2/DistributionV2.sol";
import { DistributionWalletChange } from "contracts/v2/DistributionWalletChangeV2.sol";
import { TestToken } from "contracts/TestToken.sol";
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";

/// TODO need to be implemented

contract DistributionTest is Test {
    Distribution distribution;
    DistributionWalletChange distributionWalletChange;
    CheatCodes cheats = CheatCodes(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    address OWNER;
    address ADMIN;
    address USER_01;
    address USER_02;
    address USER_03;
    address USER_04;

    TestToken tokenUSDC;
    TestToken tokenUSDC2;

    function setUp() public {
        distributionWalletChange = new DistributionWalletChange();
        distribution = new Distribution(distributionWalletChange);

        OWNER = makeAddr("owner");
        ADMIN = makeAddr("admin");
        USER_01 = makeAddr("user01");
        USER_02 = makeAddr("user02");
        USER_03 = makeAddr("user03");
        USER_04 = makeAddr("user04");

        tokenUSDC = new TestToken("USDC", 6);
        tokenUSDC2 = new TestToken("USDC", 6);
    }
}
