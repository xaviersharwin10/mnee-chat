import hre from "hardhat";

async function main() {
    console.log("🚀 Deploying MockMNEE to Sepolia...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

    // Deploy MockMNEE
    const MockMNEE = await hre.ethers.getContractFactory("MockMNEE");
    const mockMNEE = await MockMNEE.deploy();
    await mockMNEE.waitForDeployment();

    const address = await mockMNEE.getAddress();
    console.log("✅ MockMNEE deployed to:", address);
    console.log("\n📋 Add this to your .env:");
    console.log(`TOKEN_CONTRACT_ADDRESS=${address}`);

    // Verify deployment
    const name = await mockMNEE.name();
    const symbol = await mockMNEE.symbol();
    const decimals = await mockMNEE.decimals();
    const totalSupply = await mockMNEE.totalSupply();

    console.log("\n📊 Token Details:");
    console.log("  Name:", name);
    console.log("  Symbol:", symbol);
    console.log("  Decimals:", decimals.toString());
    console.log("  Total Supply:", hre.ethers.formatUnits(totalSupply, decimals), "MNEE");
    console.log("  Deployer Balance:", hre.ethers.formatUnits(totalSupply, decimals), "MNEE");

    console.log("\n🔗 View on Etherscan:");
    console.log(`https://sepolia.etherscan.io/address/${address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
