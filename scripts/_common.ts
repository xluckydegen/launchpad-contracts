import hre from "hardhat";
import { EthersNetworkAccessManager, EthersNetworkProfiles, EthersNetworks } from "../shared/ethers/classEthersNetworks";
import { EthersWallet } from "../shared/ethers/classEthersWallet";
import { Erc20Token } from "../shared/ethers/token/classErc20Token";

export async function initializeBase()
{
  try
  {
    console.log("Initializing SniperTesting fixture on ", hre.network.name);

    const { owner } = await hre.getNamedAccounts();
    const [ownerSigner] = await hre.ethers.getSigners();
    console.log("Owner account:", owner);

    const networkCfg = EthersNetworks.getConfiguration(hre.network.config.chainId);
    const isGanache = "url" in hre.network.config ? hre.network.config.url.indexOf("dockerserver") != -1 : false;
    const networkProfile = isGanache ? EthersNetworkProfiles.unittesting : EthersNetworkProfiles.default_;
    console.log("NetworkCFG configured to", networkCfg.networkId);

    //NAM
    const nam = EthersNetworkAccessManager.fromEthersProvider(networkCfg, hre.ethers.provider, networkProfile);
    const wallet = EthersWallet.fromSigner(ownerSigner.address, ownerSigner);

    /*const deployments = await hre.deployments.all();
    const tokenUSDC = Erc20Token.fromDeployment(nam, deployments.FakeUsdc, wallet);
    const tokenGMX = Erc20Token.fromDeployment(nam, deployments.FakeGmx, wallet);

    console.log("Contracts deployed to addresses:");
    console.log("- USDC:", tokenUSDC.getAddress());
    console.log("- GMX:", tokenGMX.getAddress());

    console.log("Balances:");
    console.log("- ETH:", (await nam.balanceOfEth(wallet)).toString());
    console.log("- USDC:", (await tokenUSDC.balanceOf()).toString());
    console.log("- GMX:", (await tokenGMX.balanceOf()).toString());*/

    return {
      nam, networkCfg, wallet, //tokenUSDC, tokenGMX
    };
  }
  catch (err: any)
  {
    console.log(err.toString());
    console.log(err);
    throw err;
  }
}