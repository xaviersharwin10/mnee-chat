import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { sepolia, mainnet } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSendTransaction } from 'wagmi';
import { parseUnits, parseEther } from 'viem';
import './App.css';

// Configuration
const API_BASE = import.meta.env.VITE_API_URL || 'https://mnee-chat-production.up.railway.app';
const TOKEN_ADDRESS = '0x7650906b48d677109F3C20C6B3B89eB0b793c63b'; // MockMNEE Sepolia
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
  const { isConnected, address } = useAccount();
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [sendType, setSendType] = useState('mnee'); // 'mnee' or 'gas'
  const [status, setStatus] = useState({ type: '', message: '' });
  const [derivedAddress, setDerivedAddress] = useState(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  // Fetch wallet address from API when phone changes
  useEffect(() => {
    const fetchAddress = async () => {
      const normalized = phone.replace(/[^\d]/g, '');
      if (!normalized) {
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

  // MNEE Transfer (ERC-20)
  const { data: mneeHash, isPending: mneePending, writeContract, reset: mneeReset } = useWriteContract();
  const { isLoading: mneeConfirming, isSuccess: mneeConfirmed } = useWaitForTransactionReceipt({ hash: mneeHash });

  // ETH Transfer (native)
  const { data: ethHash, isPending: ethPending, sendTransaction, reset: ethReset } = useSendTransaction();
  const { isLoading: ethConfirming, isSuccess: ethConfirmed } = useWaitForTransactionReceipt({ hash: ethHash });

  // Handle MNEE confirmation
  useEffect(() => {
    if (mneeConfirmed && mneeHash) {
      setStatus({
        type: 'success',
        message: `Sent ${amount} MNEE to ${phone}`,
        txHash: mneeHash,
      });

      // Notify recipient via WhatsApp
      fetch(`${API_BASE}/api/notify-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhone: phone,
          amount: amount,
          txHash: mneeHash,
        }),
      }).catch(err => console.log('Notification failed:', err));

      setAmount('');
      mneeReset();
    }
  }, [mneeConfirmed, mneeHash]);

  // Handle ETH confirmation
  useEffect(() => {
    if (ethConfirmed && ethHash) {
      setStatus({
        type: 'success',
        message: `Sent ${amount} ETH (gas) to ${phone}`,
        txHash: ethHash,
      });

      // Notify recipient via WhatsApp
      fetch(`${API_BASE}/api/notify-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhone: phone,
          amount: `${amount} ETH (gas)`,
          txHash: ethHash,
        }),
      }).catch(err => console.log('Notification failed:', err));

      setAmount('');
      ethReset();
    }
  }, [ethConfirmed, ethHash]);

  const handleFaucet = async (targetType) => {
    const target = targetType === 'wallet' ? address : phone;
    if (!target) return alert(targetType === 'wallet' ? 'Please connect wallet first' : 'Please enter a phone number first');

    try {
      const payload = targetType === 'wallet' ? { address: target } : { phone: target };
      const res = await fetch(`${API_BASE}/api/faucet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', message: `💰 100 Test MNEE Sent to ${targetType === 'wallet' ? 'Wallet' : 'Phone'}!`, txHash: data.txHash });
      } else {
        alert('Faucet failed: ' + data.error);
      }
    } catch (e) {
      alert('Faucet error');
    }
  };

  const handleSend = async () => {
    if (!derivedAddress || !amount) return;

    setStatus({ type: 'pending', message: 'Waiting for confirmation...' });

    try {
      if (sendType === 'mnee') {
        await writeContract({
          address: TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [derivedAddress, parseUnits(amount, 6)],
        });
      } else {
        // Send ETH (gas)
        await sendTransaction({
          to: derivedAddress,
          value: parseEther(amount),
        });
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.shortMessage || error.message });
    }
  };

  const isPending = sendType === 'mnee' ? mneePending : ethPending;
  const isConfirming = sendType === 'mnee' ? mneeConfirming : ethConfirming;
  const canSend = isConnected && derivedAddress && amount && parseFloat(amount) > 0 && !isPending && !isConfirming && !isLoadingAddress;

  return (
    <div className="container">
      <header>
        <div className="logo-row">
          <img src="/logo.png" alt="MNEEChat" className="logo-icon" style={{ width: 48, height: 48 }} />
          <h1 className="logo">MNEE<span>Chat</span></h1>
        </div>
        <p className="tagline">Send MNEE or Gas to any phone number</p>
        <a
          href="https://wa.me/14155238886?text=join%20depth-army"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '12px',
            color: '#25D366',
            textDecoration: 'none',
            fontWeight: '600',
            background: 'rgba(37, 211, 102, 0.1)',
            padding: '8px 16px',
            borderRadius: '20px',
            border: '1px solid rgba(37, 211, 102, 0.2)'
          }}
        >
          <span>💬</span> Chat on WhatsApp
        </a>
      </header>

      {/* Quick Start Guide */}
      <div className="instructions-card" style={{
        background: 'rgba(0, 0, 0, 0.05)',
        padding: '16px',
        borderRadius: '16px',
        marginBottom: '20px',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        textAlign: 'left'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#000' }}>🚀 Quick Start Guide</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: '#333' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span>1️⃣</span>
            <span><strong>Get Funds:</strong> Connect Wallet & get 100 Test MNEE.</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span>2️⃣</span>
            <span><strong>Fund Phone:</strong> Enter your number below & Send MNEE.</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span>3️⃣</span>
            <span><strong>Start Chatting:</strong> Click "Chat on WhatsApp" & send text!</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="connect-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <ConnectButton showBalance={false} />

          {/* Wallet Faucet Button - Only shown when connected */}
          {isConnected && (
            <button
              className="btn btn-secondary"
              onClick={() => handleFaucet('wallet')}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '0.9rem',
                background: 'rgba(37, 211, 102, 0.1)',
                color: '#25D366',
                border: '1px solid rgba(37, 211, 102, 0.2)'
              }}
            >
              🚰 Get 100 Test MNEE to Wallet
            </button>
          )}
        </div>

        <div className="form-group">
          <label>Phone Number (with +country code)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+919876543210"
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

          {/* Phone Faucet Button - Only shown if phone entered and NOT using wallet faucet */}
          {!isConnected && phone.length > 5 && (
            <button
              className="btn btn-secondary"
              onClick={() => handleFaucet('phone')}
              style={{ marginTop: '8px', padding: '6px', fontSize: '0.8rem', width: '100%' }}
            >
              🚰 Get Test MNEE to this Phone
            </button>
          )}
        </div>

        {/* Send Type Toggle */}
        <div className="form-group">
          <label>Send Type</label>
          <div className="toggle-buttons">
            <button
              className={`toggle-btn ${sendType === 'mnee' ? 'active' : ''}`}
              onClick={() => setSendType('mnee')}
            >
              💰 MNEE
            </button>
            <button
              className={`toggle-btn ${sendType === 'gas' ? 'active' : ''}`}
              onClick={() => setSendType('gas')}
            >
              ⛽ Gas (ETH)
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Amount ({sendType === 'mnee' ? 'MNEE' : 'ETH'})</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={sendType === 'mnee' ? '100' : '0.01'}
            step={sendType === 'mnee' ? '1' : '0.001'}
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
            sendType === 'mnee' ? 'Send MNEE' : 'Send Gas (ETH)'
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
