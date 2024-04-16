## Install

```
yarn install

```

## Rebuild contracts

```
rm cache -r -fo;rm artifacts -r -fo;rm typechain-types -r -fo; npx hardhat compile
```

## Test contracts

```
npx hardhat test
```

## Fuzzing

To spin up Echidna run:
```
docker run -it --rm -v $PWD:/src trailofbits/eth-security-toolbox
```

To fuzz test
```
echidna --contract EchidnaTest --config /src/echidna-config.yaml /src/test/v2Fuzzing/EchidnaTest.sol
```

## Links

- Sepolia CA: https://luckydegen.gitbook.io/community-launchpad/api-reference/contracts