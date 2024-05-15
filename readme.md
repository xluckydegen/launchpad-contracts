# Launchpad Contracts

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

---

📢⚠️ **Before running fuzz tests uncomment:**

```solidity
// constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
```

and comment out:

```solidity
constructor(string memory name, string memory symbol) ERC20(name, symbol) Ownable(msg.sender) {}
```

out in [MockERC20](./contracts/echidna/MockERC20.sol).

This is necessary due to **hardhat/foundry incompatibility issues**. 📢⚠️

---

To spin up Echidna in Docker, run:

```bash
sudo docker pull trailofbits/eth-security-toolbox
docker run -it --rm -v $PWD:/src trailofbits/eth-security-toolbox
```

To fuzz test

```bash
echidna --contract <CONTRACT-NAME> --config /src/echidna-config.yaml /src/contracts/echidna/<CONTRACT-NAME>.sol
# echidna --contract EchidnaTestDistribution --config echidna-config.yaml contracts/echidna/EchidnaTestDistribution.sol
```

## Links

- Sepolia CA: https://luckydegen.gitbook.io/community-launchpad/api-reference/contracts
