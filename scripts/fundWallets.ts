import hre from "hardhat";
import { EthersNetworkAccessManager, EthersNetworkProfiles, EthersNetworks } from "../shared/ethers/classEthersNetworks";
import { EthersWallet } from "../shared/ethers/classEthersWallet";
import { testWallets } from "./testWallets";

async function main() {

  console.log("Funding test wallets with ETH on", hre.network.name);

  const { owner } = await hre.getNamedAccounts();
  const [ownerSigner] = await hre.ethers.getSigners();
  console.log("Owner account:", owner);

  const networkCfg = EthersNetworks.getConfiguration(hre.network.config.chainId);
  const isGanache = "url" in hre.network.config ? hre.network.config.url.indexOf("dockerserver") != -1 : false;
  const networkProfile = isGanache ? EthersNetworkProfiles.unittesting : EthersNetworkProfiles.default_;
  console.log("NetworkCFG configured to", networkCfg.networkId);

  if ( isGanache == false )
  {
    console.log("Network is not Ganache/Hardhat network");
    return;
  }

  //NAM
  const nam = EthersNetworkAccessManager.fromEthersProvider(networkCfg, hre.ethers.provider, networkProfile);
  for ( const wallet of testWallets)
  {
    console.log(`Funding 1000ETH to wallet ${wallet}`);
    await nam.hardhatSetBalance(wallet,1000);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
