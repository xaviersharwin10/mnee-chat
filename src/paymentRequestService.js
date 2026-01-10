import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { getOrCreateWallet } from './walletService.js';
import { isCdpConfigured, sendTransactionViaCdp, getOrCreateCdpWallet } from './cdpService.js';

dotenv.config();

// PaymentRequest Contract ABI (minimal for our operations)
const PAYMENT_REQUEST_ABI = [
    'function createRequest(address payer, uint256 amount, string note) external returns (uint256)',
    'function fulfillRequest(uint256 requestId) external',
    'function cancelRequest(uint256 requestId) external',
    'function getRequest(uint256 requestId) external view returns (tuple(uint256 id, address requester, address payer, uint256 amount, string note, bool fulfilled, bool cancelled, uint256 createdAt))',
    'function getPendingRequestsAsPayer(address user) external view returns (tuple(uint256 id, address requester, address payer, uint256 amount, string note, bool fulfilled, bool cancelled, uint256 createdAt)[])',
    'function getRequestsAsRequester(address user) external view returns (uint256[])',
    'function getRequestsAsPayer(address user) external view returns (uint256[])',
    'event RequestCreated(uint256 indexed id, address indexed requester, address indexed payer, uint256 amount, string note)',
    'event RequestFulfilled(uint256 indexed id, address indexed requester, address indexed payer, uint256 amount)',
];

// Token ABI for approvals
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function decimals() external view returns (uint8)',
];

// Provider setup
const rpcUrl = process.env.ETHEREUM_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';
const provider = new ethers.JsonRpcProvider(rpcUrl);

// Contract addresses
const PAYMENT_REQUEST_ADDRESS = process.env.PAYMENT_REQUEST_ADDRESS;
const TOKEN_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS || '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9';

// Contract interfaces for encoding
const paymentRequestInterface = new ethers.Interface(PAYMENT_REQUEST_ABI);
const tokenInterface = new ethers.Interface(ERC20_ABI);

/**
 * Check if Payment Request feature is configured
 */
export function isPaymentRequestConfigured() {
    return !!PAYMENT_REQUEST_ADDRESS;
}

/**
 * Get PaymentRequest contract instance (read-only)
 */
function getPaymentRequestContract() {
    if (!PAYMENT_REQUEST_ADDRESS) {
        throw new Error('PAYMENT_REQUEST_ADDRESS not configured in .env');
    }
    return new ethers.Contract(PAYMENT_REQUEST_ADDRESS, PAYMENT_REQUEST_ABI, provider);
}

/**
 * Get Token contract instance (read-only)
 */
function getTokenContract() {
    return new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);
}

/**
 * Create a payment request using CDP
 */
export async function createPaymentRequest(requesterPhone, payerAddress, amount, note = '') {
    const tokenContract = getTokenContract();
    const decimals = await tokenContract.decimals();
    const amountWei = ethers.parseUnits(amount.toString(), decimals);

    console.log(`📩 Creating payment request: ${amount} MNEE from ${payerAddress}...`);

    // Encode the function call
    const data = paymentRequestInterface.encodeFunctionData('createRequest', [
        payerAddress,
        amountWei,
        note
    ]);

    // Send via CDP
    const result = await sendTransactionViaCdp(
        requesterPhone,
        PAYMENT_REQUEST_ADDRESS,
        data,
        'ethereum-sepolia'
    );

    console.log(`✅ Payment request created: ${result.hash}`);

    return {
        requestId: 'pending', // We'd need to parse events for the actual ID
        txHash: result.hash,
        amount,
        payer: payerAddress,
        note,
    };
}

/**
 * Fulfill/pay a payment request using CDP
 */
export async function fulfillPaymentRequest(payerPhone, requestId) {
    const contract = getPaymentRequestContract();
    const tokenContract = getTokenContract();

    // Get request details
    const request = await contract.getRequest(requestId);
    if (request.fulfilled) {
        throw new Error('Request already fulfilled');
    }
    if (request.cancelled) {
        throw new Error('Request was cancelled');
    }

    // Get payer's wallet address
    const payerWallet = await getOrCreateWallet(payerPhone);

    // Check and approve token spending via CDP
    const allowance = await tokenContract.allowance(payerWallet.address, PAYMENT_REQUEST_ADDRESS);
    if (allowance < request.amount) {
        console.log('📝 Approving token spend via CDP...');
        const approveData = tokenInterface.encodeFunctionData('approve', [
            PAYMENT_REQUEST_ADDRESS,
            request.amount
        ]);
        const approveTx = await sendTransactionViaCdp(payerPhone, TOKEN_ADDRESS, approveData, 'ethereum-sepolia');

        console.log(`⏳ Waiting for approval transaction ${approveTx.hash}...`);
        await provider.waitForTransaction(approveTx.hash);
        console.log('✅ Approval confirmed!');
    }

    console.log(`💰 Fulfilling payment request #${requestId} via CDP...`);

    // Encode the fulfill call
    const data = paymentRequestInterface.encodeFunctionData('fulfillRequest', [requestId]);
    const result = await sendTransactionViaCdp(
        payerPhone,
        PAYMENT_REQUEST_ADDRESS,
        data,
        'ethereum-sepolia'
    );

    const decimals = await tokenContract.decimals();
    const amountFormatted = ethers.formatUnits(request.amount, decimals);

    console.log(`✅ Payment request #${requestId} fulfilled!`);

    return {
        requestId,
        txHash: result.hash,
        amount: amountFormatted,
        requester: request.requester,
    };
}

/**
 * Cancel a payment request using CDP
 */
export async function cancelPaymentRequest(requesterPhone, requestId) {
    console.log(`❌ Cancelling payment request #${requestId} via CDP...`);

    const data = paymentRequestInterface.encodeFunctionData('cancelRequest', [requestId]);
    const result = await sendTransactionViaCdp(
        requesterPhone,
        PAYMENT_REQUEST_ADDRESS,
        data,
        'ethereum-sepolia'
    );

    console.log(`✅ Request #${requestId} cancelled`);

    return {
        requestId,
        txHash: result.hash,
    };
}

/**
 * Get pending requests for a payer
 */
export async function getPendingRequestsForPayer(payerPhone) {
    const payerWallet = await getOrCreateWallet(payerPhone);
    const contract = getPaymentRequestContract();
    const tokenContract = getTokenContract();

    const decimals = await tokenContract.decimals();
    const requests = await contract.getPendingRequestsAsPayer(payerWallet.address);

    return requests.map(req => ({
        id: req.id.toString(),
        requester: req.requester,
        amount: ethers.formatUnits(req.amount, decimals),
        note: req.note,
        createdAt: new Date(Number(req.createdAt) * 1000),
    }));
}

/**
 * Get requests sent by a requester
 */
export async function getRequestsForRequester(requesterPhone) {
    const requesterWallet = await getOrCreateWallet(requesterPhone);
    const contract = getPaymentRequestContract();
    const tokenContract = getTokenContract();

    // Get list of request IDs
    const requestIds = await contract.getRequestsAsRequester(requesterWallet.address);
    const requests = [];
    const decimals = await tokenContract.decimals();

    // Fetch details for each request
    // Note: optimization would be a multi-call or a specific view function on contract
    // modifying the contract is out of scope, so we loop (limited scale)
    for (const id of requestIds) {
        const req = await contract.getRequest(id);
        requests.push({
            id: req.id.toString(),
            payer: req.payer,
            amount: ethers.formatUnits(req.amount, decimals),
            note: req.note,
            fulfilled: req.fulfilled,
            cancelled: req.cancelled,
            createdAt: new Date(Number(req.createdAt) * 1000),
        });
    }

    return requests.sort((a, b) => b.createdAt - a.createdAt); // Newest first
}

/**
 * Get request details by ID
 */
export async function getRequestDetails(requestId) {
    const contract = getPaymentRequestContract();
    const tokenContract = getTokenContract();

    const decimals = await tokenContract.decimals();
    const req = await contract.getRequest(requestId);

    return {
        id: req.id.toString(),
        requester: req.requester,
        payer: req.payer,
        amount: ethers.formatUnits(req.amount, decimals),
        note: req.note,
        fulfilled: req.fulfilled,
        cancelled: req.cancelled,
        createdAt: new Date(Number(req.createdAt) * 1000),
    };
}
