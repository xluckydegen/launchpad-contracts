// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { Test } from "forge-std/Test.sol";
import { EchidnaHelpers } from "contracts/echidna/EchidnaHelpers.sol";
import { WalletChangeData } from "contracts/v2/DistributionWalletChangeV2.sol";
import { PropertiesLibString } from "contracts/echidna/PropertiesHelpers.sol";

contract TestEchidnaHelpers is Test {
    EchidnaHelpers helpers;

    address internal OWNER = address(0x10000);

    uint8 USER_01_ID = 0;
    uint8 USER_02_ID = 1;
    uint8 USER_03_ID = 2;
    uint8 USER_04_ID = 3;

    uint256 USER_01_AMOUNT = 1000;
    uint256 USER_02_AMOUNT = 2000;
    uint256 USER_03_AMOUNT = 3000;
    uint256 USER_04_AMOUNT = 4000;

    function setUp() public {
        helpers = new EchidnaHelpers();
    }

    function testRoles() public view {
        assertEq(helpers.hasAdminRole(OWNER), true);
        assertEq(helpers.hasDistributorRole(OWNER), true);
    }

    // DistributionWalletChange helpers //

    function testStoreWalletChange() public {
        // add wallet change
        helpers.storeWalletChange(USER_01_ID, USER_02_ID);
        address _userOneAddress = helpers.getUserAccount(USER_01_ID);
        address _userTwoAddress = helpers.getUserAccount(USER_02_ID);
        string memory _walletChangeUuid = PropertiesLibString.toString(_userOneAddress);
        WalletChangeData memory _walletChange = helpers.getWalletChange(_walletChangeUuid);
        assertEq(_walletChange.walletFrom, _userOneAddress);
        assertEq(_walletChange.walletTo, _userTwoAddress);
        assertEq(helpers.getWalletFromTo(_userOneAddress), _userTwoAddress);
        assertEq(helpers.getWalletToFrom(_userTwoAddress), _userOneAddress);
        assertEq(helpers.getWalletChangeCount(), 1);

        // remove the wallet change
        helpers.removeWalletChange(0);
        WalletChangeData memory _walletChangeAfterRemoval = helpers.getWalletChange(
            _walletChangeUuid
        );
        assertEq(helpers.getWalletFromTo(_userOneAddress), address(0));
        assertEq(helpers.getWalletToFrom(_userTwoAddress), address(0));
        assertTrue(_walletChangeAfterRemoval.deletedAt != 0);
    }
}
