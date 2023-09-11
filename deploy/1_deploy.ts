import { DeployFunction, DeployResult } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { EthersNetworkAccessManager } from "../shared/ethers/classEthersNetworkAccessManager";
import { EthersNetworks } from "../shared/ethers/classEthersNetworks";
import { EthersWallet } from "../shared/ethers/classEthersWallet";
import { Erc20Token } from "../shared/ethers/token/classErc20Token";
//const util = require("util");
import { ethers } from "hardhat";
import util from "util";
import { AxSystemHelper } from "../shared/helpers/classAxSystemHelper";
import { EthersContract } from "../shared/ethers/contracts/classContract";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment)
{
  try
  {
    console.log("Deploying Launchpad to", hre.network.name);

    const { owner } = await hre.getNamedAccounts();
    const [ownerSigner] = await hre.ethers.getSigners();
    console.log("Owner account:", owner);

    const networkCfg = EthersNetworks.getConfiguration(hre.network.config.chainId);
    console.log("NetworkCFG configured to", networkCfg.networkId);
    console.log(`Hardhat configured to network ${hre.network.name}`);

    //NAM
    const nam = EthersNetworkAccessManager.fromEthersProvider(networkCfg, hre.ethers.provider);
    const isGanache = hre.network.name.indexOf("hardhat") != -1 || hre.network.name.indexOf("ganache") != -1;
    nam.networkConfigurationRpc.isLocalFork = isGanache ? "ganache" : undefined;

    const wallet = EthersWallet.fromSigner(ownerSigner.address, ownerSigner);
    const gasMultiply = 1.3; //hre.network.name == "goerli" ? 2  : 1.3;

    console.log("Balance ETH: ", (await nam.balanceOfEth(wallet.public)).toString());
    nam.profile.consoleSettings.ethCall = true;
    const getGasForDeploy = async () =>
    {
      const options = await nam.getEthersNetworkOptions({ gasSettings: { gasMultiply } });
      return options.gasPrice?.toString();
    };

    const adminWallets = [
      EthersWallet.fromPrivateKey("6b0c602efa1da3969641b18a431b2a606b60e7c88cc7b9d86f0b1db073d2707a"),
      EthersWallet.fromPrivateKey("6bf4eb4203ec7ea11377fb03ff43da70f306579b3fc372893afd6a73ac600862"),
    ];
    const editorWallets = [
      EthersWallet.fromPrivateKey("5aee529ee6e2eb872c23006eb11b48bbf59f72f59a7a6abe440309398404819e")
    ];

    console.log("Deploying contracts");

    console.log(" - deploying community manager");
    const deployedCommunity: DeployResult = await hre.deployments.deploy("CommunityManager", {
      contract: "CommunityManager",
      from: owner,
      args: [],
      log: true,
      autoMine: true,
      gasPrice: await getGasForDeploy()
    });
    const contractCommunityManager = Erc20Token.fromDeployment(nam, deployedCommunity, wallet, { gasSettings: { gasMultiply } });

    console.log(" - registering primary community");
    const primaryCommunityUuid = "aaaaaaaa-35e7-11ee-be56-0242ac120002";
    const existsCommunity = await contractCommunityManager.direct().existCommunityByUuid(primaryCommunityUuid);
    if (!existsCommunity)
      await contractCommunityManager.direct().registerCommunity(primaryCommunityUuid);

    console.log(" - registering community NFT");
    const deployedCommunityMemberNft: DeployResult = await hre.deployments.deploy("CommunityMemberNft", {
      contract: "CommunityMemberNft",
      from: owner,
      args: [contractCommunityManager.getAddress(), primaryCommunityUuid],
      log: true,
      autoMine: true,
      gasPrice: await getGasForDeploy()
    });
    const contractCommunityMemberNft = Erc20Token.fromDeployment(nam, deployedCommunityMemberNft, wallet, { gasSettings: { gasMultiply } });

    console.log(" - registering deal manager");
    const deployedDeal: DeployResult = await hre.deployments.deploy("DealManager", {
      contract: "DealManager",
      from: owner,
      args: [],
      log: true,
      autoMine: true,
      gasPrice: await getGasForDeploy()
    });
    const contractDealManager = Erc20Token.fromDeployment(nam, deployedDeal, wallet, { gasSettings: { gasMultiply } });

    console.log(" - registering deal interest discovery");
    const deployedDealInterestDiscovery: DeployResult = await hre.deployments.deploy("DealInterestDiscovery", {
      contract: "DealInterestDiscovery",
      from: owner,
      args: [contractDealManager.getAddress(), contractCommunityMemberNft.getAddress()],
      log: true,
      autoMine: true,
      gasPrice: await getGasForDeploy()
    });
    const contractDealInterestDiscovery = Erc20Token.fromDeployment(nam, deployedDealInterestDiscovery, wallet, { gasSettings: { gasMultiply } });

    console.log(" - registering deal fundraising");
    const deployedDealFundraising: DeployResult = await hre.deployments.deploy("DealFundraising", {
      contract: "DealFundraising",
      from: owner,
      args: [contractDealManager.getAddress(), contractCommunityMemberNft.getAddress(), contractDealInterestDiscovery.getAddress()],
      log: true,
      autoMine: true,
      gasPrice: await getGasForDeploy()
    });
    const contractDealFundRaising = Erc20Token.fromDeployment(nam, deployedDealFundraising, wallet, { gasSettings: { gasMultiply } });

    let contractTestToken: Erc20Token | undefined;
    if (nam.networkConfiguration.isTestnet || nam.networkConfigurationRpc.isLocalFork)
    {
      console.log(" - deploying testing USDC");
      const deployedTestToken: DeployResult = await hre.deployments.deploy("TestToken", {
        contract: "TestToken",
        from: owner,
        args: ["testUSDC"],
        log: true,
        autoMine: true,
        gasPrice: await getGasForDeploy()
      });
      contractTestToken = Erc20Token.fromDeployment(nam, deployedTestToken, wallet, { gasSettings: { gasMultiply } });

      await nam.refreshProviderNonces();
      for (const walletTarget of [...adminWallets, ...editorWallets])
      {
        if (nam.networkConfigurationRpc.isLocalFork)
          await nam.transferEth(wallet, walletTarget, 1);

        const deployedToken = EthersContract.fromDeployment(nam, deployedTestToken, wallet);
        const balance = await contractTestToken.balanceOfAddress(walletTarget.public);
        if (balance.lt(10_000))
          await deployedToken.connect(walletTarget).direct().mint(10_000n * 10n ** 18n);
      }
    }

    console.log("Configuring admin wallets");
    await nam.refreshProviderNonces();
    const gasSettings = { gasSettings: { gasLimit: 500_000 } };

    for (const walletAdmin of adminWallets)
    {
      console.log(` - ${walletAdmin.public}`);
      const roleAdmin = ethers.utils.formatBytes32String("");
      const roleEditor = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EDITOR"));

      const hasRoles = await contractCommunityManager.direct(gasSettings).hasRole(roleEditor, walletAdmin.public);
      if (!hasRoles)
      {
        await contractCommunityManager.direct(gasSettings).grantRole(roleEditor, walletAdmin.public);
        await contractDealManager.direct(gasSettings).grantRole(roleEditor, walletAdmin.public);
        await contractDealFundRaising.direct(gasSettings).grantRole(roleAdmin, walletAdmin.public);
      }
    }

    console.log("Configuring editor wallets");
    for (const walletEditor of editorWallets)
    {
      console.log(` - ${walletEditor.public}`);
      const roleEditor = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EDITOR"));

      const hasRoles = await contractCommunityManager.direct(gasSettings).hasRole(roleEditor, walletEditor.public);
      if (!hasRoles)
      {
        await contractCommunityManager.direct(gasSettings).grantRole(roleEditor, walletEditor.public);
        await contractDealManager.direct(gasSettings).grantRole(roleEditor, walletEditor.public);
        await contractDealFundRaising.direct(gasSettings).grantRole(roleEditor, walletEditor.public);
      }
    }

    if (!nam.networkConfigurationRpc.isLocalFork)
    {
      while (true)
      {
        try
        {
          console.log("Uploading verifications");
          console.log("- contract community manager");
          await hre.run("verify:verify", {
            address: contractCommunityManager.getAddress(),
            constructorArguments: [],
          });

          console.log("- community NFT");
          await hre.run("verify:verify", {
            address: contractCommunityMemberNft.getAddress(),
            constructorArguments: [
              contractCommunityManager.getAddress(),
              primaryCommunityUuid
            ],
          });

          console.log("- deal manager");
          await hre.run("verify:verify", {
            address: contractDealManager.getAddress(),
            constructorArguments: [
            ],
          });

          console.log("- deal interest discovery");
          await hre.run("verify:verify", {
            address: contractDealInterestDiscovery.getAddress(),
            constructorArguments: [
              contractDealManager.getAddress(), contractCommunityMemberNft.getAddress()
            ],
          });

          console.log("- deal fundraising");
          await hre.run("verify:verify", {
            address: contractDealFundRaising.getAddress(),
            constructorArguments: [
              contractDealManager.getAddress(), contractCommunityMemberNft.getAddress(), contractDealInterestDiscovery.getAddress()
            ],
          });


          if (contractTestToken)
          {
            console.log("- test token");
            await hre.run("verify:verify", {
              address: contractTestToken.getAddress(),
              constructorArguments: [
                "testUSDC"
              ],
            });
          }
          break;
        } catch (err)
        {
          console.log("Error uploading Etherscan data:", err);
          console.log("Retrying");
          AxSystemHelper.sleep(5 * 1000);
        }
      }
    }

    console.log("Contracts deployed to addresses:");
    console.log("- Community mngr  :", contractCommunityManager.getAddress());
    console.log("- Community  NFT  :", contractCommunityMemberNft.getAddress());
    console.log("- Deals mngr      :", contractDealManager.getAddress());
    console.log("- DealsInterestDis:", contractDealInterestDiscovery.getAddress());
    console.log("- DealsFundraising:", contractDealFundRaising.getAddress());
    console.log("- TestToken:", contractTestToken?.getAddress());

    console.log("Contracts data:");
    console.log("- PrimaryCommunity:", primaryCommunityUuid);

    console.log("Wallets:");
    console.log("- Owner:", wallet.public);
    for (const walletAdmin of adminWallets)
      console.log("- admin:", walletAdmin.public);
    for (const walletEditor of editorWallets)
      console.log("- editor:", walletEditor.public);

    console.log("Remaining ETH: ", (await nam.balanceOfEth(wallet.public)).toString());

    const symbol = await contractTestToken?.symbol();
    console.log("CODE:");
    console.log(`contractCommunityManager: "${contractCommunityManager.getAddress()}",`);
    console.log(`contractCommunityMemberNft :"${contractCommunityMemberNft.getAddress()}",`);
    console.log(`contractDealManager :"${contractDealManager.getAddress()}",`);
    console.log(`contractDealInterestDiscovery :"${contractDealInterestDiscovery.getAddress()}",`);
    console.log(`contractDealFundraising:"${contractDealFundRaising.getAddress()}",`);
    console.log(`contractCollectedToken:"${contractTestToken?.getAddress()}",`);
    console.log(`contractCollectedTokenSymbol:"${symbol}",`);
    console.log(`contractCollectedTokenDecimals:${await contractTestToken?.getDecimals()},`);
  }
  catch (err: any)
  {
    console.log("Err.toString", err.toString());
    console.log("err", err);
    console.error("inspect:", util.inspect(err));
  }
};
export default func;
func.tags = ["Launchpad"];

//npx hardhat deploy --tags SniperToken --network goerli --reset