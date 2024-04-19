import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";

import "@typechain/hardhat";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import "hardhat-preprocessor";
import { HardhatUserConfig, task } from "hardhat/config";
import "solidity-coverage";

// The following part is used to instruct hardhat not to compile specific tests
// mainly because incompability issues with Foundry
// for more info, see https://github.com/NomicFoundation/hardhat/issues/2306#issuecomment-1184427001

import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from "hardhat/builtin-tasks/task-names";
import { subtask } from "hardhat/config";
import path from "path";

subtask(
  TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
  async (_, { config }, runSuper) => {
    const paths = await runSuper();

    return paths
      .filter((solidityFilePath: string) => {
        const relativePath = path.relative(config.paths.sources, solidityFilePath);
        
        // DO NOT COMPILE ECHIDNA TESTS
        return !relativePath.toLowerCase().includes("echidna");
      })
  }
);

//example project https://github.com/wighawag/template-ethereum-contracts

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.23",
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
        count: 10
      },
      allowUnlimitedContractSize: true
    },
  }
};

export default config;
