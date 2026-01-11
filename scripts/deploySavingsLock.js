import hre from "hardhat";

async function main() {
    console.log("🚀 Deploying SavingsLock to Sepolia...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

    // MockMNEE token address on Sepolia
    const TOKEN_ADDRESS = "0x7650906b48d677109F3C20C6B3B89eB0b793c63b";

    // Deploy SavingsLock
    const SavingsLock = await hre.ethers.getContractFactory("SavingsLock");
    const savingsLock = await SavingsLock.deploy(TOKEN_ADDRESS);
    await savingsLock.waitForDeployment();

    const address = await savingsLock.getAddress();
    console.log("✅ SavingsLock deployed to:", address);
    console.log("\n📋 Add this to your .env:");
    console.log(`SAVINGS_LOCK_ADDRESS=${address}`);

    console.log("\n🔗 View on Etherscan:");
    console.log(`https://sepolia.etherscan.io/address/${address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
