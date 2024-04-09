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
npx mocha -r ts-node/register test ./test/**/*.test.ts
```

## Links

- Sepolia CA: https://luckydegen.gitbook.io/community-launchpad/api-reference/contracts