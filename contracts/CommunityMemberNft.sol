// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./CommunityManager.sol";
import "./EmergencyWithdraw.sol";

struct CommunityMemberNftData {
    string communityUuid;
    uint createdAt;
}

interface ICommunityMemberNft {
    function mint() external;
    function mintCommunity(string memory communityUuid) external;
    function hasCommunityNft(address wallet) external view returns (bool);
}

contract CommunityMemberNft is
    ICommunityMemberNft,
    ERC721,
    ERC721Enumerable,
    AccessControl, 
    EmergencyWithdraw
{
    //last update
    uint public lastMintedAt;

    ICommunityManager public communityManager;
    string public defaultCommunityUuid;

    //nft data
    mapping(uint256 => CommunityMemberNftData) public nftData;

    //counter
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    //events
    event MemberNftMinted(string communityUuid, address owner, uint256 tokenId);

    constructor(
        ICommunityManager _communityManager,
        string memory _defaultCommunityUuid
    ) ERC721("CommunityMemberNft", "CommunityMemberNft") {
        communityManager = _communityManager;
        defaultCommunityUuid = _defaultCommunityUuid;
    }

    function mint() public override {
        mintCommunity(defaultCommunityUuid);
    }

    function mintCommunity(string memory communityUuid) public override {
        require(
            communityManager.existCommunityByUuid(communityUuid),
            "Unknown community ID"
        );
        require(balanceOf(msg.sender) == 0, "Only one mint allowed");

        lastMintedAt = block.timestamp;
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(msg.sender, tokenId);
        nftData[tokenId] = CommunityMemberNftData(
            communityUuid,
            block.timestamp
        );

        emit MemberNftMinted(communityUuid, msg.sender, tokenId);
    }

    function hasCommunityNft(address wallet) external view returns (bool) {
        return balanceOf(wallet) > 0;
    }

    // The following functions are overrides required by Solidity.
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        require(
            from == address(0) || to == address(0),
            "Soulbound NFT cant be transferred"
        );
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _baseURI() internal pure override returns (string memory) {
        return "baseuritest";
    }
}
