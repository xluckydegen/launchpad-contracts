## Install

Be sure you have foundry installed (if not, follow instructions [here](https://book.getfoundry.sh/getting-started/installation)), then run:

```
yarn install
foundryup
forge install
```

## Rebuild contracts

```
rm cache -r -fo;rm artifacts -r -fo;rm typechain-types -r -fo; npx hardhat compile
forge build
```

## Test contracts

```
npx hardhat test
forge test
```

## Fuzzing

### Run fuzzing campaigns

To spin up Echidna run:
```
sudo docker pull trailofbits/eth-security-toolbox
docker run -it --rm -v $PWD:/src trailofbits/eth-security-toolbox
```

To fuzz test
```
echidna --contract <CONTRACT-NAME> --config /src/echidna-config.yaml /src/contracts/echidna/<CONTRACT-NAME>.sol
```
### Invariants

Below is the list of invariants (TO BE ADDED):

(1) If Merkle does not contains any address, nobody can claim any token even though tokens for distribution were deposited.
(2) If tokens in the given distribution were claimed at least once, `merkleRoot`, `tokensTotal`, and `token` cannot be changed anymore.
(3) If tokens deposited, token for the given distribution cannot be changed anymore

## Links

- Sepolia CA: https://luckydegen.gitbook.io/community-launchpad/api-reference/contracts
