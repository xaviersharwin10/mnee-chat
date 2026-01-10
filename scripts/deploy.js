import pkg from "hardhat";
const { ethers } = pkg;
import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🚀 Deploying SquadVault contract...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Token address (PyUSD on Sepolia for testing, or MNEE on mainnet)
  const TOKEN_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS || process.env.MNEE_CONTRACT_ADDRESS || "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";

  // For demo purposes, use deployer as initial member
  // In production, members would be passed as parameters
  const members = [deployer.address];
  const threshold = 1; // For single member demo, threshold is 1

  console.log("\n📋 Deployment Parameters:");
  console.log("Members:", members);
  console.log("Threshold:", threshold);
  console.log("Token Address:", TOKEN_ADDRESS);

  // Deploy contract
  const SquadVault = await ethers.getContractFactory("SquadVault");
  const vault = await SquadVault.deploy(members, threshold, TOKEN_ADDRESS);

  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  const network = await ethers.provider.getNetwork();
  const etherscanUrl = network.chainId === 11155111n
    ? `https://sepolia.etherscan.io/address/${vaultAddress}`
    : `https://etherscan.io/address/${vaultAddress}`;

  console.log("\n✅ SquadVault deployed to:", vaultAddress);
  console.log("View on Etherscan:", etherscanUrl);

  // Save deployment info
  const deploymentInfo = {
    contractAddress: vaultAddress,
    deployer: deployer.address,
    members: members,
    threshold: threshold,
    token: TOKEN_ADDRESS,
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
  };

  console.log("\n📄 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

