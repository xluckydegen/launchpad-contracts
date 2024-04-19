// contracts/GLDToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestToken is ERC20, Ownable {
    uint256 public tokenTotalSupply;
    uint256 public maxTransferAmount;
    bool public transferAllowed = true;
    uint8 public configuredDecimals;

    mapping(address => bool) public bannedAddresses;
    mapping(address => uint256) public transferLimitedAddresses;
    mapping(address => bool) public transferExcludedAddresses;

    constructor(string memory _name, uint8 _decimals) ERC20(_name, _name) {
        configuredDecimals = _decimals;
        tokenTotalSupply = 100_000_000 * 10 ** configuredDecimals;
        maxTransferAmount = tokenTotalSupply;
        _mint(msg.sender, tokenTotalSupply);
        transferExcludedAddresses[owner()] = true;
    }

    function decimals() public view virtual override returns (uint8) {
        return configuredDecimals;
    }

    function mint(uint256 amount) public {
        _mint(msg.sender, amount);
    }

    function allowTransfer(bool enabled_) public {
        transferAllowed = enabled_;
    }

    function banAddress(address addr_) public {
        bannedAddresses[addr_] = true;
    }

    function banAddresses(address[] memory addr_) public {
        for (uint256 n = 0; n < addr_.length; n++) {
            bannedAddresses[addr_[n]] = true;
        }
    }

    function unbanAddress(address addr_) public {
        bannedAddresses[addr_] = false;
    }

    function unbanAddresses(address[] memory addr_) public {
        for (uint256 n = 0; n < addr_.length; n++) {
            bannedAddresses[addr_[n]] = false;
        }
    }

    function setMaxTransferAmount(uint256 amount_) public {
        maxTransferAmount = amount_ * 10 ** configuredDecimals;
    }

    function _transfer(address from, address to, uint256 amount) internal override {
        require(transferAllowed == true, "token transfers disabled");
        require(bannedAddresses[from] == false, "from addr banned");
        require(bannedAddresses[to] == false, "to addr banned");

        require(
            transferExcludedAddresses[msg.sender] == true || transferExcludedAddresses[from] == true
                || transferExcludedAddresses[to] == true || amount <= maxTransferAmount,
            "Transfer too high."
        );
        super._transfer(from, to, amount);
    }
}
