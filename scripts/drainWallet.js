import { getOrCreateCdpWallet, getCdpClient } from '../src/cdpService.js';
import dotenv from 'dotenv';

dotenv.config();

const DRAIN_TO_ADDRESS = '0x5b3D9fdc502c6816e8fb0721AA4F57E4519cB5dB';
const PHONE_NUMBER = '919840647352';
// We know the balance is ~0.05 ETH. Send 0.045 to leave room for gas.
const AMOUNT_TO_SEND = '45000000000000000'; // 0.045 ETH in wei

async function main() {
    console.log(`\n🔍 Draining wallet for phone: ${PHONE_NUMBER}...`);
    console.log(`📤 Sending 0.045 ETH to: ${DRAIN_TO_ADDRESS}\n`);

    try {
        const cdp = getCdpClient();

        // Get the wallet for this phone
        const wallet = await getOrCreateCdpWallet(PHONE_NUMBER);
        console.log(`📱 Wallet: ${wallet.address}`);
        console.log(`📤 Sending...`);

        // Send ETH via CDP
        const result = await cdp.evm.sendTransaction({
            address: wallet.address,
            transaction: {
                to: DRAIN_TO_ADDRESS,
                value: AMOUNT_TO_SEND,
            },
            network: 'ethereum-sepolia'
        });

        console.log(`✅ Sent! Tx: https://sepolia.etherscan.io/tx/${result.transactionHash}`);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
