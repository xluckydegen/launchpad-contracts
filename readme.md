# Launchpad Contracts

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
        <a href="#installation">Installation</a>
    </li>
    <li>
        <a href="#rebuild-contracts">Fuzzing</a>
    </li>
    <li>
        <a href="#links">Links</a>
    </li>
    <li>
        <a href="#contacts">Contacts</a>
    </li>
  </ol>
</details>


## Installation

Be sure you have foundry installed (if not, follow instructions [here](https://book.getfoundry.sh/getting-started/installation)), then run:

```bash
yarn install
foundryup
forge install
```

### Rebuild Contracts

```bash
rm cache -r -fo;rm artifacts -r -fo;rm typechain-types -r -fo; npx hardhat compile
forge build
```

### Test contracts

```bash
npx hardhat test
forge test
```

## Fuzzing

More details about fuzzing campaign can be found at the **[Fuzzing Report](./contracts/echidna/fuzzing-report.md)**.

### Run fuzzing campaigns

---

📢⚠️ **Before running fuzz tests uncomment:**

```solidity
// constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
```

and comment out in [MockERC20](./contracts/echidna/MockERC20.sol):

```solidity
constructor(string memory name, string memory symbol) ERC20(name, symbol) Ownable(msg.sender) {}
```

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


## Contacts

- contracts developed by luckydegen ([Angel Squad](https://www.angelssquad.com/))
- fuzzing brought by [0xharold](lubos.harasta@themama.ai) ([MAMA AI](https://themama.ai/))