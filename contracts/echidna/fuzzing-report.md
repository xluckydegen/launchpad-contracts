# Fuzzing Report

This report contains defined invariants and validation of fuzz tests by bug injections. To run the fuzzing campaign, please follow the instructions in [Readme.md](../../readme.md).

Furthermore, during building the fuzzing campaign, several tests were written (see tests at [test/foundry](../../test/foundry/)) mostly to facilitate debugging.

## Invariants

### Assumptions, simplifications

1. Currently, we do not aim to fuzz multiple distributions running simultaneously (to simplify the fuzzing process for now).
2. Regarding to the point 1, we do not fuzz multiple claims at once, i.e., `claimMultiple` in [Distribution](./contracts/v2/DistributionV2.sol).
3. `emergencyImportClaims` needs to be as flexible as possible for unexpected emergency situation; thus it is not the subject of fuzzing campaign either.

Below is the list of invariants:

### 1. Claims and Claiming Process

- [x] 1. Users cannot claim more tokens than their `maxAmount`
- [x] 2. User cannot claim if `enabled` flag in `DistributionData` is set to `true`.
- [ ] (PARTIALLY TESTED) 3. User cannot claim more tokens proportionally to `tokensDistributable`. i.e. user's balance after claim must be always equal to the tokens claimable in the given round.
- [x] 4. User's token balance must always increase after successful claim.
- [x] 5. Distribution's token balance must always decrease after successful claim.
- [x] 6. User can always claim if eligible.
- [x] 7. A wallet which funds has been redirected from cannot claim anymore.

#### 2. Token and Distribution Consistency

- [x] 1. The `tokensDistributable` must always be less than or equal to `tokensTotal` for any distribution.
- [x] 2. The sum of all claimed tokens by individual wallets should never exceed the `tokensDistributable` in a given distribution.
- [x] 3. The sum of all claimed tokens by individual wallets should never exceed the `tokensTotal` in a given distribution.
- [x] 4. Distribution contract balance of the claiming tokens must not decrease less that amount claimed.

#### 3. Role-Based Access Control

- [ ] 1. Only an account with the `DEFAULT_ADMIN_ROLE` can store a new distribution.
- [ ] 2. Only an account with the `DISTRIBUTOR_ROLE` can deposit tokens to a distribution.

#### 4. Emergency states

- [ ] 1. Emergency import of claims cannot be applied if tokens has been already deposited into the distribution.
- [ ] 2. The emergency withdraw function should only be callable by an account with the `DEFAULT_ADMIN_ROLE`.

#### 5. User Address Changes

- [ ] 1. A wallet address must not be redirected to more than one target address at any given time.
- [ ] 2. Wallet address redirection must not create circular dependencies.
- [ ] 3. Wallet address redirection must not point to zero address.
- [ ] 4. If a wallet address has been redirected through a wallet change, the original address cannot be used for claims.
- [ ] 5. Any wallet address change must not allow an address to claim more than its entitled/remaining amount.

#### 6. Array and Mapping Integrity"

- [ ] 1. The length of `distributionsIndexed` must always match the count of unique distributions stored in the contract.
- [ ] 2. The length of `distributionWalletsClaims[distributionUuid]` should always match the number of unique wallet addresses that have made claims against the `distributionUuid`.
- [ ] 3. The `walletClaims` mapping should accurately reflect the amount of tokens claimed by each wallet for a given distribution.
- [ ] 4. The amount of tokens deposited for a distribution must always match the tracked amount in `distributionDeposited`.
- [ ] 5. The sum of claimed amounts for a wallet across all distributions must match the total claims recorded for that wallet.

### 7. Contracts mutability

- [ ] 1. If tokens in the given distribution were claimed at least once, `merkleRoot`, `tokensTotal`, and `token` cannot be changed anymore.
- [ ] 2. If tokens deposited into the distribution, token for the given distribution cannot be changed anymore.

## Validation of fuzz tests

Validation of fuzz tests was performed by inserting bugs into the target contracts to let Echidna break the invariants. All validation tests assume that the other fuzz tests have been commented out.

### `usersCannotClaimMoreTokensThanMaxAmount` 

Test should prove that the number of claimed tokens in `walletClaims[distributionUuid][claimingAddress]` is never going to be more than user's `maxAmount` of claimable tokens (the invariant 1.1).

**Verification**:

1. Insert the bug into the claim function:

```solidity
    function claim(
        string memory distributionUuid,
        uint256 maxAmount,
        bytes32[] memory proof
    ) public {
        // omitted part of the body

        // UPDATE STORAGE
        lastChangeAt = block.timestamp;
        distributionLastChangeAt[distributionUuid] = block.timestamp;
        distributionClaimed[distributionUuid] += amountToClaim;
        distributionWalletsClaims[distributionUuid].push(claimingAddress);
        walletClaims[distributionUuid][claimingAddress] += (amountToClaim + 10); // BUG inserted to violate the invariant 1.1
        // walletClaims[distributionUuid][claimingAddress] += amountToClaim; // original version

        // omitted part of the body
    }
```

### `userCannotClaimIfAlreadyClaimedMaxAmount`

Test should prove that user cannot claim anymore if already claimed `maxAmount` (the invariant 1.1).

**Verification**:

1. Insert the bug into the claim function:

```solidity
    function claim(
        string memory distributionUuid,
        uint256 maxAmount,
        bytes32[] memory proof
    ) public {
        // omitted part of the body

        uint256 amountClaimable = convert(udAmountClaimable);
        uint256 amountClaimed = walletClaims[distributionUuid][claimingAddress];
        // BUG injection starts here
        if (amountClaimed > 0) {
            amountClaimed = 0;
        }
        // BUG injection ends here
        if (amountClaimed >= amountClaimable) revert Distribution_NothingToClaim();

        uint256 amountToClaim = amountClaimable - amountClaimed;

        // omitted part of the body
    }
```

### `userCannotClaimWhenPaused`

The test should prove that user cannot claim if distribution contract is paused (the invariant 1.2).

**Verification**:

1. Insert the bug into the claim function:

```solidity
    function claim(
        string memory distributionUuid,
        uint256 maxAmount,
        bytes32[] memory proof
    ) public {
        address claimingAddress = distributionWalletChange.translateAddressToSourceAddress(
            msg.sender
        );
        DistributionData memory distr = distributions[distributionUuid];

        //DISTRIBUTION DATA VALIDATION
        if (distr.createdAt == 0) revert Distribution_DataNotExists();
        if (distr.enabled == false) revert Distribution_Disabled();
        // if (distributionsPaused == true) revert Distribution_Disabled(); // BUG comment this line out 

        // the rest of the function body
    }
```

### `userCannotClaimMoreTokenProportionallyToTokensDistributable`

The test should validate that user cannot claim all token when `tokensDistributable` is less than `tokensTotal` (the invariant 1.3).

**Verification**:

1. Insert the bug into the claim function:

```solidity
    function claim(
        string memory distributionUuid,
        uint256 maxAmount,
        bytes32[] memory proof
    ) public {
        // omitted part of the function body

        uint256 amountToClaim = amountClaimable - amountClaimed;
        // BUG injection starts here
        if (amountClaimed == 0) {
            amountToClaim = maxAmount;
        }
        // BUG injection ends here

        IERC20 token = distr.token;
        if (token.balanceOf(address(this)) < amountToClaim) revert Distribution_NotEnoughTokens();

        // omitted part of the body
    }
```

### `redirectedWalletCannotClaimAnymore`

The test should prove that once wallet is redirected, there is no chance that it can continue claiming (invariant 1.7)

**Verification**:

1. Insert the bug into the claim function:

```solidity
    function claim(
        string memory distributionUuid,
        uint256 maxAmount,
        bytes32[] memory proof
    ) public {
        // BUG injection starts here
        // first, comment out the following line
        // address claimingAddress = distributionWalletChange.translateAddressToSourceAddress(
        //     msg.sender
        // );
        // second, add the next line
        address claimingAddress = msg.sender; 
        // BUG injection ends here
        
        DistributionData memory distr = distributions[distributionUuid];

        // the rest of the function
    }
```

### `userSuccessfulClaimInvariants`

The test should prove that user should be able to claim if eligible and if enough tokens are in the contract and pass all the invariants related (invariants: 1.4, 1.5, 1.6, adn 2.4)

**Verification**:

1. Insert the bug into the claim function:

```solidity
    function claim(
        string memory distributionUuid,
        uint256 maxAmount,
        bytes32[] memory proof
    ) public {
        // omitted part of the function body

        // TRANSFER
        token.safeTransfer(msg.sender, 1); // BUG injection

        uint256 claimedTotal = walletClaims[distributionUuid][claimingAddress];
        emit DistributionClaimed(distributionUuid, claimingAddress, amountToClaim, claimedTotal);
    }
```

### `tokensDistributableLteTokensTotal`

The test should prove that `distribution.tokensTotal` is always equal or higher than `distribution.tokensDistributable` (invariant 2.1).

**Verification**:

1. Insert the bug into the storeDistribution function:

```solidity
    function storeDistribution(
        DistributionData memory distribution
    ) public override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bytes(distribution.uuid).length == 0) {
            revert Distribution_InvalidData("DU");
        } //Invalid uuid (missing)
        if (address(distribution.token) == address(0)) {
            revert Distribution_InvalidData("DT");
        } //Invalid token (null address)
        if (distribution.merkleRoot.length == 0) {
            revert Distribution_InvalidData("DM");
        } //Invalid merkle tree (empty)
        if (distribution.tokensTotal == 0) {
            revert Distribution_InvalidData("DTC");
        } //Invalid total tokens (cant be zero)
        //BUG injection below (comment out the following check)
        // if (distribution.tokensTotal < distribution.tokensDistributable) {
        //     revert Distribution_InvalidData("TT_TD");
        // } //Distributable tokens larger than total tokens
```

### `totalAmountClaimedLteTokensDistributable`

The test should prove that `distribution.tokensDistributable` is always equal or higher than total amount of tokens claimed for the given distribution (invariant 2.2).

**Verification**:

1. Insert the bug into the depositTokensToDistribution function:

```solidity
    function claim(
        string memory distributionUuid,
        uint256 maxAmount,
        bytes32[] memory proof
    ) public {
        // omitted part of the body

        // UPDATE STORAGE
        lastChangeAt = block.timestamp;
        distributionLastChangeAt[distributionUuid] = block.timestamp;
        distributionClaimed[distributionUuid] += amountToClaim;
        distributionWalletsClaims[distributionUuid].push(claimingAddress);
        walletClaims[distributionUuid][claimingAddress] += (amountToClaim + 10); // BUG injected 
        // walletClaims[distributionUuid][claimingAddress] += amountToClaim; // original version

        // omitted part of the body
    }
```

### `totalAmountClaimedLteTokensTotal` 

The test should prove that `distribution.tokensTotal` is always equal or higher than total amount of tokens claimed for the given distribution (invariant 2.2).

**Verification**:

1. Insert the bug into the depositTokensToDistribution function:

```solidity
    function claim(
        string memory distributionUuid,
        uint256 maxAmount,
        bytes32[] memory proof
    ) public {
        // omitted part of the body

        // UPDATE STORAGE
        lastChangeAt = block.timestamp;
        distributionLastChangeAt[distributionUuid] = block.timestamp;
        distributionClaimed[distributionUuid] += amountToClaim;
        distributionWalletsClaims[distributionUuid].push(claimingAddress);
        walletClaims[distributionUuid][claimingAddress] += (amountToClaim + 10); // BUG injected 
        // walletClaims[distributionUuid][claimingAddress] += amountToClaim; // original version

        // omitted part of the body
    }
```

### `totalAmountClaimedEqualsAlreadyClaimedTotal`

To test should prove that all claimed tokens by users match with internal accounting (invariant 2.4).

**Verification**:

1. Insert the bug into the claim function:

```solidity
    function claim(
        string memory distributionUuid,
        uint256 maxAmount,
        bytes32[] memory proof
    ) public {
        // omitted part of the function

        // UPDATE STORAGE
        lastChangeAt = block.timestamp;
        distributionLastChangeAt[distributionUuid] = block.timestamp;
        distributionClaimed[distributionUuid] += amountToClaim;
        // BUG injection starts here
        distributionWalletsClaims[distributionUuid].push(claimingAddress);
        // BUG injection ends here
        walletClaims[distributionUuid][claimingAddress] += amountToClaim;

        // TRANSFER
        token.safeTransfer(msg.sender, amountToClaim);

        uint256 claimedTotal = walletClaims[distributionUuid][claimingAddress];
        emit DistributionClaimed(distributionUuid, claimingAddress, amountToClaim, claimedTotal);
    }
```