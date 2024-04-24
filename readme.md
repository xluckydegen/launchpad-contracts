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

To spin up Echidna run:

```bash
sudo docker pull trailofbits/eth-security-toolbox
docker run -it --rm -v $PWD:/src trailofbits/eth-security-toolbox
```

To fuzz test

```bash
echidna --contract <CONTRACT-NAME> --config /src/echidna-config.yaml /src/contracts/echidna/<CONTRACT-NAME>.sol
```

### Invariants

Below is the list of invariants (TO BE ADDED):

- (1) If Merkle does not contains any address, nobody can claim any token even though tokens for distribution were deposited.
- (2) If tokens in the given distribution were claimed at least once, `merkleRoot`, `tokensTotal`, and `token` cannot be changed anymore.
- (3) If tokens deposited, token for the given distribution cannot be changed anymore

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
