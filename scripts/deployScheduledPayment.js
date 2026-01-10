import pkg from "hardhat";
const { ethers } = pkg;
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("🚀 Deploying ScheduledPayment contract...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    // Token address (PyUSD on Sepolia)
    const TOKEN_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS || "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";

    console.log("\n📋 Deployment Parameters:");
    console.log("Token Address:", TOKEN_ADDRESS);

    // Deploy contract
    const ScheduledPayment = await ethers.getContractFactory("ScheduledPayment");
    const scheduledPayment = await ScheduledPayment.deploy(TOKEN_ADDRESS);

    await scheduledPayment.waitForDeployment();
    const contractAddress = await scheduledPayment.getAddress();

    console.log("\n✅ ScheduledPayment deployed to:", contractAddress);
    console.log("View on Etherscan: https://sepolia.etherscan.io/address/" + contractAddress);

    // Output for .env
    console.log("\n📝 Add to .env:");
    console.log(`SCHEDULED_PAYMENT_ADDRESS=${contractAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
