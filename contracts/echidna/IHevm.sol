// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IHevm
 * @notice Hevm is an EVM implementation mainly dedicated to testing and exploration, it features a set of cheat codes which can manipulate the environment in which the execution is run.
 * These can be accessed by calling into a contract at address 0x7109709ECfa91a80626fF3989D68f67F5b1DD12D, which implements the following methods
 */
interface IHevm {
    // Sets the block timestamp to x
    function warp(uint256 x) external;

    // Sets the block number to x
    function roll(uint256 x) external;

    // Sets the eth balance of usr to amt.
    // Note that if usr is a symbolic address, then it must be the address of a contract that has already been deployed. This restriction is in place to ensure soundness of our symbolic address encoding with respect to potential aliasing of symbolic addresses.
    function deal(uint usr, uint amt) external;

    // Stores a value to an address' storage slot
    function store(address where, bytes32 slot, bytes32 value) external;

    // Loads a storage slot from an address
    function load(address where, bytes32 slot) external returns (bytes32);

    // Signs data (privateKey, digest) => (r, v, s)
    function sign(
        uint256 privateKey,
        bytes32 digest
    ) external returns (uint8 r, bytes32 v, bytes32 s);

    // Derives an ethereum address from the private key sk.
    // Note that hevm.addr(0) will fail with BadCheatCode as 0 is an invalid ECDSA private key
    function addr(uint256 sk) external returns (address addr);

    // Executes the arguments as a command in the system shell and returns stdout. Expects abi encoded values to be returned from the shell or an error will be thrown. Note that this cheatcode means test authors can execute arbitrary code on user machines as part of a call to dapp test, for this reason all calls to ffi will fail unless the --ffi flag is passed.
    function ffi(string[] calldata) external returns (bytes memory);

    // Sets msg.sender to the specified sender for the next call.
    function prank(address sender) external;
}
