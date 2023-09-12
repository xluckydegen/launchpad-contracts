import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@typechain/hardhat";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import "hardhat-preprocessor";
import "hardhat-test-utils";
import { HardhatUserConfig, task } from "hardhat/config";
import "solidity-coverage";

//example project https://github.com/wighawag/template-ethereum-contracts

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ]
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
  defaultNetwork: "hardhat",
  namedAccounts: {
    owner: 0,
    addr1: 1,
    addr2: 2,
    addr3: 3,
    addr4: 4,
  },

  networks: {
    hardhat: {
      chainId: 11155111,
      forking: {
        url: "https://eth-sepolia.g.alchemy.com/v2/7nGy9Vk01a95XV4nJD74dXfSNUaAfPoW",
      },
      accounts: {
        mnemonic: "caution junk bid base sphere lyrics connect tiny comic chicken crop label",
        count: 6
      },
      allowUnlimitedContractSize: true
    },
    ganacheArbitrum: {
      chainId: 42161,
      url: "http://dockerserver.dum:8557",
      accounts: ["88930b734f2eb08ecd9385d7251c0b2c3dd658ae79cef2c3f5b51390aae91fa4"], //dev 03
    },
    arbitrumOne: {
      url: "https://arb-mainnet.g.alchemy.com/v2/nWnCB-J_NdAoKSwun2LVN2R7cwq2VL1y",
      chainId: 42161,
      timeout: 10000,
      accounts: ["88930b734f2eb08ecd9385d7251c0b2c3dd658ae79cef2c3f5b51390aae91fa4"], //dev 03
    },
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/7nGy9Vk01a95XV4nJD74dXfSNUaAfPoW",
      chainId: 11155111,
      timeout: 10000,
      gasMultiplier: 1.1,
      accounts: ["ed7e228b736b55a6e48da73c13f459f7fdced71c5db9dcb78c113f342adbf5e9"], //launchpad wallet
    },
  },

  etherscan: {
    apiKey: {
      goerli: "RNPE5P5DJ4ZH2TT2UWFU7JQZHQ3QKI8QF2",
      sepolia: "RNPE5P5DJ4ZH2TT2UWFU7JQZHQ3QKI8QF2",
      polygonMumbai: "R2IURBP9CWGEA8SJBDHENCGSBR2V3PBRJT",
      arbitrumOne: "IIGBQQWWUCB4U8C2ZTWVGBN9QU94S1NK7P"
    }
  },

  preprocess: {
    eachLine: (hre) => ({
      transform: (line) =>
      {
        if (line.startsWith("// contracts") || line.startsWith("// SPDX"))
          return line;

        //line + '// comment at the end of each line',
        return line.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "$1");
      },
      settings: { comment: true } // ensure the cache is working, in that example it can be anything as there is no option, the preprocessing happen all the time
    })
  },


  /*gasReporter: {
    currency: 'USD',
    gasPrice: 100,
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    maxMethodDiff: 10,
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  mocha: {
    timeout: 0,
  },*/

};


task("accounts", "Prints the list of accounts", async (taskArgs, hre) =>
{
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts)
    console.log(account.address);
});


export default config;
