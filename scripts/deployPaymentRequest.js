import pkg from "hardhat";
const { ethers } = pkg;
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("🚀 Deploying PaymentRequest contract...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    // Token address (MockMNEE on Sepolia)
    const TOKEN_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS || "0x7650906b48d677109F3C20C6B3B89eB0b793c63b";

    console.log("\n📋 Deployment Parameters:");
    console.log("Token Address:", TOKEN_ADDRESS);

    // Deploy contract
    const PaymentRequest = await ethers.getContractFactory("PaymentRequest");
    const paymentRequest = await PaymentRequest.deploy(TOKEN_ADDRESS);

    await paymentRequest.waitForDeployment();
    const contractAddress = await paymentRequest.getAddress();

    console.log("\n✅ PaymentRequest deployed to:", contractAddress);
    console.log("View on Etherscan: https://sepolia.etherscan.io/address/" + contractAddress);

    // Output for .env
    console.log("\n📝 Add to .env:");
    console.log(`PAYMENT_REQUEST_ADDRESS=${contractAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
