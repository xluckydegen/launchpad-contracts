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

/*
  https://github.com/PaulRBerg/prb-math
  PRBMath max 59/60+18dec

  tokensDistributable / tokensTotal * maxUserAmount

  e18  / e18 * e18
  e1 * e18
  e18

  tokensDistributable * maxUserAmount / tokensTotal 

  e18 * e18 / e18
  e36 / e18
  e18
  */

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
    uint256 tokensTotal; // max amount of tokens
    uint256 tokensDistributable; // amount of tokens being currently distributed
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

struct DistributionState {
    string uuid;
    uint256 lastChangedAt;
    uint256 deposited;
    uint256 claimed;
    uint256 claimsCount;
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
    // ███╗   ███╗ ██████╗  ██████╗ ███╗   ██╗██╗  ██╗██╗██╗     ██╗
    // ████╗ ████║██╔═══██╗██╔═══██╗████╗  ██║██║  ██║██║██║     ██║
    // ██╔████╔██║██║   ██║██║   ██║██╔██╗ ██║███████║██║██║     ██║
    // ██║╚██╔╝██║██║   ██║██║   ██║██║╚██╗██║██╔══██║██║██║     ██║
    // ██║ ╚═╝ ██║╚██████╔╝╚██████╔╝██║ ╚████║██║  ██║██║███████╗███████╗
    // ╚═╝     ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝

    //last update
    uint256 public lastChangeAt;

    IDistributionWalletChange distributionWalletChange;

    //data
    bool public distributionsPaused;
    string[] public distributionsIndexed;
    mapping(string => DistributionData) public distributions;
    mapping(string => mapping(address => uint256)) public walletClaims;
    mapping(string => address[]) public distributionWalletsClaims; //can be multiple times!
    mapping(string => uint256) public distributionDeposited;
    mapping(string => uint256) public distributionClaimed;
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
            revert Distribution_InvalidData("DU"); //Invalid uuid (missing)
        if (address(distribution.token) == address(0))
            revert Distribution_InvalidData("DT"); //Invalid token (null address)
        if (distribution.merkleRoot.length == 0)
            revert Distribution_InvalidData("DM"); //Invalid merkle tree (empty)
        if (distribution.tokensTotal == 0)
            revert Distribution_InvalidData("DTC"); //Invalid total tokens (cant be zero)
        if (distribution.tokensTotal < distribution.tokensDistributable)
            revert Distribution_InvalidData("TT_TD"); //Distributable tokens larger than total tokens

        uint256 alreadyDeposited = distributionDeposited[distribution.uuid];
        if (distribution.tokensDistributable < alreadyDeposited)
            revert Distribution_InvalidData("TD_AD"); //Already distributed tokens larger than total tokens

        distribution.updatedAt = block.timestamp;
        if (distribution.createdAt == 0)
            distribution.createdAt = block.timestamp;

        DistributionData memory distributionStored = distributions[
            distribution.uuid
        ];
        if (
            distributionStored.createdAt != 0 &&
            distributionDeposited[distribution.uuid] > 0 &&
            distributionStored.token != distribution.token
        ) revert Distribution_InvalidData("RTC"); //Trying to change token after deposits were made

        if (
            distributionStored.createdAt != 0 &&
            distributionClaimed[distribution.uuid] > 0 &&
            distributionStored.merkleRoot != distribution.merkleRoot
        ) revert Distribution_InvalidData("RMC"); //Trying to change merkle tree after claims were made
        
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
            revert Distribution_DataNotExists(); //Depositing to non existing distribution

        uint256 alreadyDeposited = distributionDeposited[distributionUuid];
        if (
            distributionStored.tokensDistributable <
            alreadyDeposited + depositAmount
        ) revert Distribution_InvalidParams("TB_TD"); //Depositing more than tokens distributable

        IERC20 token = distributionStored.token;
        if (token.balanceOf(msg.sender) < depositAmount)
            revert Distribution_NotEnoughTokens(); //Not enough tokens for deposit

        //store deposited amount
        distributionDeposited[distributionUuid] += depositAmount;
        distributionLastChangeAt[distributionUuid] = block.timestamp;
        lastChangeAt = block.timestamp;

        //transfer tokens
        token.safeTransferFrom(msg.sender, address(this), depositAmount);

        emit DistributionDeposited(distributionUuid, depositAmount);
    }

    //claiming multiple distributions in one tx
    function claimMultiple(DistributionClaimParams[] memory claims) public {
        // NOTE:
        // if multiple claims and the first one fails, following claims never go through; is that okay?
        // -> if not, use try/catch?
        for (uint claimNo = 0; claimNo < claims.length; claimNo++)
            claim(
                claims[claimNo].distributionUuid,
                claims[claimNo].maxAmount,
                claims[claimNo].proof
            );
    }

    /**
     * claim tokens from a distribution
     * @dev flow: (1) validate distribution data, (2) validate merkle proof, (3) perform calculations, (4) validate calculations,
     * (5) update storage, (6) transfer
     */
    function claim(
        string memory distributionUuid,
        uint256 maxAmount,
        bytes32[] memory proof
    ) public {
        address claimingAddress = distributionWalletChange
            .translateAddressToSourceAddress(msg.sender);
        DistributionData memory distr = distributions[distributionUuid];

        //DISTRIBUTION DATA VALIDATION
        if (distr.createdAt == 0) revert Distribution_DataNotExists();
        if (distr.enabled == false) revert Distribution_Disabled();
        if (distributionsPaused == true) revert Distribution_Disabled();

        //MERKLE VALIDATION
        bytes32 leaf = keccak256(
            bytes.concat(keccak256(abi.encode(claimingAddress, maxAmount)))
        );
        if (!MerkleProof.verify(proof, distr.merkleRoot, leaf))
            revert Distribution_InvalidMerkleProof();

        //CALCULATIONS AND CALCULATIONS VALIDATION
        UD60x18 udTokensDistributable = convert(distr.tokensDistributable);
        UD60x18 udTokensTotal = convert(distr.tokensTotal);
        UD60x18 udAmountClaimable = udTokensDistributable
            .mul(convert(maxAmount))
            .div(udTokensTotal);

        uint256 amountClaimable = convert(udAmountClaimable);
        uint256 amountClaimed = walletClaims[distributionUuid][claimingAddress];

        if (amountClaimed >= amountClaimable)
            revert Distribution_NothingToClaim();

        uint256 amountToClaim = amountClaimable - amountClaimed;

        IERC20 token = distr.token;
        if (token.balanceOf(address(this)) < amountToClaim)
            revert Distribution_NotEnoughTokens();

        // UPDATE STORAGE
        lastChangeAt = block.timestamp;
        distributionLastChangeAt[distributionUuid] = block.timestamp;
        distributionClaimed[distributionUuid] += amountToClaim;
        distributionWalletsClaims[distributionUuid].push(claimingAddress);
        walletClaims[distributionUuid][claimingAddress] += amountToClaim;

        // TRANSFER
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

    function emergencyDistributionsPause(
        bool _paused
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        distributionsPaused = _paused;
    }

    function distributionWalletsClaimsCount(
        string memory distributionUuid
    ) external view returns (uint256) {
        return distributionWalletsClaims[distributionUuid].length;
    }

    function distributionsCount() external view returns (uint256) {
        return distributionsIndexed.length;
    }

    function distributionsArray() external view returns (string[] memory) {
        return distributionsIndexed;
    }

    function distributionsStateArray(
        uint256 changedFrom
    ) external view returns (DistributionState[] memory) {
        uint256 records = 0;
        for (uint ix = 0; ix < distributionsIndexed.length; ix++)
            if (
                distributionLastChangeAt[distributionsIndexed[ix]] > changedFrom
            ) records++;

        DistributionState[] memory result = new DistributionState[](records);
        if (records == 0) return result;

        records = 0;
        for (uint ix = 0; ix < distributionsIndexed.length; ix++) {
            string memory uuid = distributionsIndexed[ix];
            if (distributionLastChangeAt[uuid] > changedFrom) {
                result[ix].uuid = uuid;
                result[ix].lastChangedAt = distributionLastChangeAt[uuid];
                result[ix].deposited = distributionDeposited[uuid];
                result[ix].claimed = distributionClaimed[uuid];
                result[ix].claimsCount = distributionWalletsClaims[uuid].length;
                records++;
            }
        }
        return result;
    }
}
