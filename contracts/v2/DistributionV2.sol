// SPDX-License-Identifier: MIT
// math: https://github.com/PaulRBerg/prb-math
pragma solidity >=0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./DistributionWalletChangeV2.sol";
import "../v2Behaviors/BehaviorEmergencyWithdraw.sol";
import "hardhat/console.sol";
import {UD60x18, ud, convert} from "@prb/math/src/UD60x18.sol";

using SafeERC20 for IERC20;

error Distribution_InvalidData(string msg);
error Distribution_DataNotExists();
error Distribution_NotEnoughTokens();
error Distribution_InvalidParams(string msg);
error Distribution_NothingToClaim();
error Distribution_InvalidMerkleProof();
error Distribution_Disabled();

struct DistributionData {
    string uuid;
    uint createdAt;
    uint updatedAt;
    IERC20 token;
    uint256 tokensTotal;
    uint256 tokensDistributable;
    bytes32 merkleRoot;
    bool enabled;
}

struct DistributionClaimParams {
    string distributionUuid;
    uint256 maxAmount;
    bytes32[] proof;
}

struct DistributionImportRecord {
    address wallet;
    uint256 claimedAmount;
}

interface IDistribution {
    function storeDistribution(DistributionData memory distribution) external;

    function depositTokensToDistribution(
        string memory distributionUuid,
        uint256 depositAmount
    ) external;

    function claim(
        string memory distributionUuid,
        uint256 maxAmount,
        bytes32[] calldata _proof
    ) external;
}

contract Distribution is
    IDistribution,
    AccessControl,
    BehaviorEmergencyWithdraw
{
    //last update
    uint256 public lastChangeAt;

    IDistributionWalletChange distributionWalletChange;

    //data
    string[] public distributionsIndexed;
    mapping(string => DistributionData) public distributions;
    mapping(string => mapping(address => uint256)) public walletClaims;
    mapping(string => address[]) public distributionWalletsClaims; //can be multiple times!
    mapping(string => uint256) public distributionDeposited;
    mapping(string => uint256) public distributionLastChangeAt;

    //events
    event DistributionStored(string uuid);
    event DistributionDeposited(string uuid, uint256 amount);
    event DistributionClaimed(string uuid, address wallet, uint256 amount);

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR");

    constructor(IDistributionWalletChange _ditributiondistribution) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
        distributionWalletChange = _ditributiondistribution;
    }

    //register distribution (can be called multiple times)
    function storeDistribution(
        DistributionData memory distribution
    ) public override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bytes(distribution.uuid).length == 0)
            revert Distribution_InvalidData("DU");
        if (address(distribution.token) == address(0))
            revert Distribution_InvalidData("DT");
        if (distribution.merkleRoot.length == 0)
            revert Distribution_InvalidData("DM");
        if (distribution.tokensTotal == 0)
            revert Distribution_InvalidData("DTC");
        if (distribution.tokensTotal < distribution.tokensDistributable)
            revert Distribution_InvalidData("TT_TD");

        uint256 alreadyDeposited = distributionDeposited[distribution.uuid];
        if (distribution.tokensDistributable < alreadyDeposited)
            revert Distribution_InvalidData("TD_AD");

        distribution.updatedAt = block.timestamp;
        if (distribution.createdAt == 0)
            distribution.createdAt = block.timestamp;

        DistributionData memory distributionStored = distributions[
            distribution.uuid
        ];
        if (distributionStored.createdAt == 0)
            distributionsIndexed.push(distribution.uuid);
        distributions[distribution.uuid] = distribution;

        emit DistributionStored(distribution.uuid);

        distributionLastChangeAt[distribution.uuid] = block.timestamp;
        lastChangeAt = block.timestamp;
    }

    //deposit tokens to distribution
    function depositTokensToDistribution(
        string memory distributionUuid,
        uint256 depositAmount
    ) external override onlyRole(DISTRIBUTOR_ROLE) {
        DistributionData memory distributionStored = distributions[
            distributionUuid
        ];
        if (distributionStored.createdAt == 0)
            revert Distribution_DataNotExists();

        uint256 alreadyDeposited = distributionDeposited[distributionUuid];
        if (
            distributionStored.tokensDistributable <
            alreadyDeposited + depositAmount
        ) revert Distribution_InvalidParams("TB_TD");

        IERC20 token = distributionStored.token;
        if (token.balanceOf(msg.sender) < depositAmount)
            revert Distribution_NotEnoughTokens();

        //transfer tokens
        token.safeTransferFrom(msg.sender, address(this), depositAmount);
        emit DistributionDeposited(distributionUuid, depositAmount);

        //store deposited amount
        distributionDeposited[distributionUuid] += depositAmount;
        distributionLastChangeAt[distributionUuid] = block.timestamp;
        lastChangeAt = block.timestamp;
    }

    //claiming multiple distributions in one tx
    function claimMultiple(DistributionClaimParams[] memory claims) public {
        for (uint claimNo = 0; claimNo < claims.length; claimNo++)
            claim(
                claims[claimNo].distributionUuid,
                claims[claimNo].maxAmount,
                claims[claimNo].proof
            );
    }

    //distribution claming
    function claim(
        string memory distributionUuid,
        uint256 maxAmount,
        bytes32[] memory proof
    ) public {
        address claimingAddress = distributionWalletChange
            .translateAddressToSourceAddress(msg.sender);
        DistributionData memory distr = distributions[distributionUuid];
        if (distr.createdAt == 0) revert Distribution_DataNotExists();
        if (distr.enabled == false) revert Distribution_Disabled();

        UD60x18 udTokensDistributable = convert(distr.tokensDistributable);
        UD60x18 udTokensTotal = convert(distr.tokensTotal);

        //(distr.tokensDistributable * dividingPrecision) / distr.tokensTotal;
        UD60x18 udRatioUnlocked = udTokensDistributable.div(udTokensTotal);

        //(maxAmount * ratioUnlocked) / dividingPrecision;
        UD60x18 udAmountClaimable = udRatioUnlocked.mul(convert(maxAmount));

        uint256 amountClaimable = convert(udAmountClaimable);
        uint256 amountClaimed = walletClaims[distributionUuid][claimingAddress];

        if (amountClaimed >= amountClaimable)
            revert Distribution_NothingToClaim();

        bytes32 leaf = keccak256(
            bytes.concat(keccak256(abi.encode(claimingAddress, maxAmount)))
        );
        if (!MerkleProof.verify(proof, distr.merkleRoot, leaf))
            revert Distribution_InvalidMerkleProof();

        uint256 amountToClaim = amountClaimable - amountClaimed;

        lastChangeAt = block.timestamp;
        distributionLastChangeAt[distributionUuid] = block.timestamp;
        distributionWalletsClaims[distributionUuid].push(claimingAddress);
        walletClaims[distributionUuid][claimingAddress] += amountToClaim;

        IERC20 token = distr.token;
        if (token.balanceOf(address(this)) < amountToClaim)
            revert Distribution_NotEnoughTokens();
        token.safeTransfer(msg.sender, amountToClaim);

        emit DistributionClaimed(
            distributionUuid,
            claimingAddress,
            amountToClaim
        );
    }

    function emergencyImportClaims(
        string memory distributionUuid,
        DistributionImportRecord[] memory records
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lastChangeAt = block.timestamp;
        distributionLastChangeAt[distributionUuid] = block.timestamp;

        for (uint recordNo = 0; recordNo < records.length; recordNo++) {
            address wallet = records[recordNo].wallet;
            uint256 amount = records[recordNo].claimedAmount;
            distributionWalletsClaims[distributionUuid].push(wallet);
            walletClaims[distributionUuid][wallet] = amount;
        }
    }

    function distributionWalletsClaimsCount(
        string memory distributionUuid
    ) external view returns (uint256) {
        return distributionWalletsClaims[distributionUuid].length;
    }

    function distributionsCount() external view returns (uint256) {
        return distributionsIndexed.length;
    }
}
