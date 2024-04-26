# Moonhill Launchpad Contracts

## Installation

Be sure you have foundry installed (if not, follow instructions [here](https://book.getfoundry.sh/getting-started/installation)), then run:

```bash
yarn install
foundryup
forge install
```

## Rebuild contracts

```bash
rm cache -r -fo;rm artifacts -r -fo;rm typechain-types -r -fo; npx hardhat compile
forge build
```

## Test contracts

```bash
npx hardhat test
forge test
```

## Fuzzing

### Run fuzzing campaigns

To spin up Echidna in Docker, run:

```bash
sudo docker pull trailofbits/eth-security-toolbox
docker run -it --rm -v $PWD:/src trailofbits/eth-security-toolbox
```

To fuzz test

```bash
echidna --contract <CONTRACT-NAME> --config /src/echidna-config.yaml /src/contracts/echidna/<CONTRACT-NAME>.sol
```

### Invariants

Below is the list of invariants:

#### Claims and Claiming Process

- [x] 1. Users cannot claim more tokens than their `maxAmount`
- [x] 2. User cannot claim if `enabled` flag in `DistributionData` is set to `true`.
- [ ] 3. User cannot claim more tokens proportionally to `tokensDistributable`. i.e. user's balance after claim must be always equal to the tokens claime.
- [ ] 4. User's token balance must always increase after successful claim.
- [ ] ?. The amount claimed by a wallet for a distribution must always be non-negative.

#### Token and Distribution Consistency

- [x] 1. The `tokensDistributable` must always be less than or equal to `tokensTotal` for any distribution.
- [x] 2. The sum of all claimed tokens by individual wallets should never exceed the `tokensDistributable` in a given distribution.
- [x] 3. The sum of all claimed tokens by individual wallets should never exceed the `tokensTotal` in a given distribution.
- [ ] 4. Distribution contract balance of the claiming tokens must not decrease less that amount claimed.
  
#### TODO create a name of the invariants group

- [ ] 1. If tokens in the given distribution were claimed at least once, `merkleRoot`, `tokensTotal`, and `token` cannot be changed anymore.
- [ ] 2. If tokens deposited into the distribution, token for the given distribution cannot be changed anymore.

#### Role-Based Access Control

- [ ] 1. Only an account with the `DEFAULT_ADMIN_ROLE` can store a new distribution.
- [ ] 2. Only an account with the `DISTRIBUTOR_ROLE` can deposit tokens to a distribution.

#### Emergency states

- [ ] 1. Emergency import of claims must cannot be applied if tokens has been already deposited into the distribution.
- [ ] 2. The emergency withdraw function should only be callable by an account with the `DEFAULT_ADMIN_ROLE`.

#### User Address Changes

- [ ] 1. A wallet address must not be redirected to more than one target address at any given time.
- [ ] 2. Wallet address redirection must not create circular dependencies.
- [ ] 3. Wallet address redirection must not point to zero address.
- [ ] 4. If a wallet address has been redirected through a wallet change, the original address cannot be used for claims.
- [ ] 5. Any wallet address change must not allow an address to claim more than its entitled/remaining amount.

#### Array and Mapping Integrity"

- [ ] 1. The length of distributionsIndexed must always match the count of unique distributions stored in the contract.
- [ ] 2. The length of distributionWalletsClaims[distributionUuid] should always match the number of unique wallet addresses that have made claims against the distributionUuid.
- [ ] 3. The walletClaims mapping should accurately reflect the amount of tokens claimed by each wallet for a given distribution.
- [ ] 4. The amount of tokens deposited for a distribution must always match the tracked amount in distributionDeposited.
- [ ] 5. The sum of claimed amounts for a wallet across all distributions must match the total claims recorded for that wallet.

### Assumptions, simplifications

1. Currently we do not aim to fuzz multiple distributions running simultaneously (to simplify fuzzing process for now).
2. Regarding to the point 1, we do not fuzz multiple claims at once.


### To Be Resolved

- [ ] Should also be the owner of the contract considered as a valid user account (see [EchidnaConfig](./contracts/echidna/EchidnaConfig.sol)) and hence be included into the Merkle related operations?
- [ ] 
- [ ] Prefer Assertion testing mode over Properties? 

### TODO

- [ ] Fuzz multiple distributions running;
- [ ] Fuzz Emergency cases;
  - [ ] `emergencyTokenWithdraw`
  - [ ] `emergencyEthWithdraw`
  - [ ] `emergencyImportClaims`
- [ ] Fuzz DistributionWalletChange;

## Links

- Sepolia CA: https://luckydegen.gitbook.io/community-launchpad/api-reference/contracts
