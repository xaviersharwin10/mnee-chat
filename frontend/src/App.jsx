import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { sepolia, mainnet } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import './App.css';

// Configuration
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TOKEN_ADDRESS = '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9'; // MNEE Sepolia
const ETHERSCAN_BASE = 'https://sepolia.etherscan.io';

const config = getDefaultConfig({
  appName: 'MNEEChat',
  projectId: '1a240ae3b33be6f8e103b0ab20f114af',
  chains: [sepolia, mainnet],
});

const queryClient = new QueryClient();

// ERC-20 ABI
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
];

function SendToPhone() {
  const { isConnected } = useAccount();
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [derivedAddress, setDerivedAddress] = useState(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  // Fetch wallet address from API when phone changes
  useEffect(() => {
    const fetchAddress = async () => {
      const normalized = phone.replace(/[^\d]/g, '');
      if (normalized.length < 10) {
        setDerivedAddress(null);
        return;
      }

      setIsLoadingAddress(true);
      try {
        const res = await fetch(`${API_BASE}/api/wallet/${normalized}`);
        if (res.ok) {
          const data = await res.json();
          setDerivedAddress(data.address);
        } else {
          setDerivedAddress(null);
        }
      } catch (err) {
        console.error('Failed to fetch wallet address:', err);
        setDerivedAddress(null);
      }
      setIsLoadingAddress(false);
    };

    const debounce = setTimeout(fetchAddress, 300);
    return () => clearTimeout(debounce);
  }, [phone]);

  const { data: hash, isPending, writeContract, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (isConfirmed && hash) {
      setStatus({
        type: 'success',
        message: `Sent ${amount} MNEE to ${phone}`,
        txHash: hash,
      });
      setAmount('');
      reset();
    }
  }, [isConfirmed, hash]);

  const handleSend = async () => {
    if (!derivedAddress || !amount) return;

    setStatus({ type: 'pending', message: 'Waiting for confirmation...' });

    try {
      await writeContract({
        address: TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [derivedAddress, parseUnits(amount, 6)],
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.shortMessage || error.message });
    }
  };

  const canSend = isConnected && derivedAddress && amount && parseFloat(amount) > 0 && !isPending && !isConfirming && !isLoadingAddress;

  return (
    <div className="container">
      <header>
        <div className="logo-row">
          <svg className="logo-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="24" fill="#25D366" />
            <path d="M34 18.5L22.5 30L14 21.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1 className="logo">MNEE<span>Chat</span></h1>
        </div>
        <p className="tagline">Send MNEE to any phone number via WhatsApp</p>
      </header>

      <div className="card">
        <div className="connect-section">
          <ConnectButton showBalance={false} />
        </div>

        <div className="form-group">
          <label>Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98406 47352"
          />
          {isLoadingAddress && (
            <div className="derived-address" style={{ opacity: 0.6 }}>
              Loading wallet...
            </div>
          )}
          {derivedAddress && !isLoadingAddress && (
            <div className="derived-address">
              → {derivedAddress}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Amount (MNEE)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSend}
          disabled={!canSend}
        >
          {isPending || isConfirming ? (
            <><span className="loading"></span> Sending...</>
          ) : (
            'Send MNEE'
          )}
        </button>

        {status.message && (
          <div className={`message ${status.type}`}>
            {status.type === 'success' ? '✓ ' : status.type === 'error' ? '✗ ' : ''}
            {status.message}
            {status.txHash && (
              <>
                {' · '}
                <a href={`${ETHERSCAN_BASE}/tx/${status.txHash}`} target="_blank" rel="noopener noreferrer">
                  View tx
                </a>
              </>
            )}
          </div>
        )}
      </div>

      <footer>
        <a href="https://mnee.io" target="_blank" rel="noopener noreferrer">MNEE</a>
        {' · '}
        <a href="https://etherscan.io/token/0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF" target="_blank" rel="noopener noreferrer">Contract</a>
      </footer>
    </div>
  );
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <SendToPhone />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
