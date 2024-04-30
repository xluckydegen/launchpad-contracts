// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title Top-level mixin for configuring the desired fuzzing setup
 * @notice inspired by https://github.com/rappie/origindollar-fuzzing-public/blob/main/src/echidna/EchidnaConfig.sol
 */
contract EchidnaConfig {
    address internal ADDRESS_USER_01 = address(0x10000);
    address internal ADDRESS_USER_02 = address(0x20000);
    address internal ADDRESS_USER_03 = address(0x30000);
    address internal ADDRESS_USER_04 = address(0x40000);

    uint8 internal USER_COUNT = 4;

    /**
     * @notice Translate an account ID to an address
     * @param accountId The ID of the account
     * @return account The address of the account
     */
    function getUserAccount(uint8 accountId) public view returns (address account) {
        accountId = accountId % USER_COUNT;

        if (accountId == 0) return account = ADDRESS_USER_01;
        if (accountId == 1) return account = ADDRESS_USER_02;
        if (accountId == 2) return account = ADDRESS_USER_03;
        if (accountId == 3) return account = ADDRESS_USER_04;

        require(false, "Invalid account ID (USER_COUNT is wrong)");
    }
}
