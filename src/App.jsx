import { useEffect, useState } from "react";
import { ethers } from "ethers";

const ETHERSCAN_URL = "https://sepolia.etherscan.io";

const TOKEN_CONFIG = [
  { symbol: "USDC", address: "0x1c7D4B196Cb0C7B01d894A7d5F5Cd7D69C6baf43", decimals: 6, price: 1 },
  { symbol: "USDT", address: "0x7169D38820dfd117C3FA1f22a697dBA58dC90eE7", decimals: 6, price: 1 },
  { symbol: "WETH", address: "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c", decimals: 18, price: 3500 },
];

const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address,uint256) returns (bool)",
];

const formatAddress = (value) =>
  value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "Not connected";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [balance, setBalance] = useState(0);
  const [network, setNetwork] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedAsset, setSelectedAsset] = useState("ETH");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [tokenBalances, setTokenBalances] = useState([]);
  const [recentTxs, setRecentTxs] = useState([
    { type: "Received", asset: "ETH", amount: "+0.25", date: "Today, 09:45" },
    { type: "Sent", asset: "USDT", amount: "-250.00", date: "Yesterday, 18:20" },
    { type: "Received", asset: "BTC", amount: "+0.12", date: "Mon, 08:12" },
  ]);

  const portfolioValue =
    balance * 3500 +
    tokenBalances.reduce((sum, token) => sum + token.balance * token.price, 0);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setStatus("MetaMask is not installed.");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const account = accounts[0];
      await loadWalletData(account, provider);
      setStatus("Wallet connected successfully.");
    } catch (error) {
      console.error(error);
      setStatus("Wallet connection failed.");
    }
  };

  const loadWalletData = async (account, provider) => {
    try {
      const networkInfo = await provider.getNetwork();
      const ethBalance = Number(ethers.formatEther(await provider.getBalance(account)));

      setWalletAddress(account);
      setNetwork(networkInfo.name || "Unknown network");
      setBalance(ethBalance);

      const tokenData = await Promise.all(
        TOKEN_CONFIG.map(async (token) => {
          try {
            const contract = new ethers.Contract(token.address, erc20Abi, provider);
            const rawBalance = await contract.balanceOf(account);
            const decimals = await contract.decimals();
            const formattedBalance = Number(ethers.formatUnits(rawBalance, decimals));
            return { ...token, balance: formattedBalance };
          } catch (error) {
            return { ...token, balance: 0 };
          }
        })
      );

      setTokenBalances(tokenData);
    } catch (error) {
      console.error("Failed to load wallet data", error);
      setStatus("Failed to load wallet data.");
    }
  };

  useEffect(() => {
    const autoConnect = async () => {
      if (!window.ethereum) return;

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_accounts", []);

        if (accounts && accounts.length) {
          await loadWalletData(accounts[0], provider);
        }
      } catch (error) {
        console.error("Auto-connect failed", error);
      }
    };

    autoConnect();
  }, []);

  const copyAddress = async () => {
    if (!walletAddress) return;

    try {
      await navigator.clipboard.writeText(walletAddress);
      setStatus("Wallet address copied.");
    } catch (error) {
      setStatus("Unable to copy wallet address.");
    }
  };

  const sendTransaction = async () => {
    if (!window.ethereum || !walletAddress) {
      setStatus("Connect a wallet first.");
      return;
    }

    if (!recipient || !amount) {
      setStatus("Recipient and amount are required.");
      return;
    }

    setLoading(true);
    setStatus("");
    setTxHash("");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      if (selectedAsset === "ETH") {
        const tx = await signer.sendTransaction({
          to: recipient,
          value: ethers.parseEther(amount),
        });

        await tx.wait();
        setTxHash(tx.hash);
        setStatus("ETH transaction sent successfully.");
      } else {
        const token = TOKEN_CONFIG.find((item) => item.symbol === selectedAsset);
        if (!token) throw new Error("Token not found");

        const contract = new ethers.Contract(token.address, erc20Abi, signer);
        const parsedAmount = ethers.parseUnits(amount, token.decimals);
        const tx = await contract.transfer(recipient, parsedAmount);
        await tx.wait();
        setTxHash(tx.hash);
        setStatus(`${token.symbol} transfer sent successfully.`);
      }

      const freshAccountData = await provider.getBalance(walletAddress);
      setBalance(Number(ethers.formatEther(freshAccountData)));

      const refreshedTokens = await Promise.all(
        TOKEN_CONFIG.map(async (token) => {
          try {
            const contract = new ethers.Contract(token.address, erc20Abi, provider);
            const raw = await contract.balanceOf(walletAddress);
            const decimals = await contract.decimals();
            return { ...token, balance: Number(ethers.formatUnits(raw, decimals)) };
          } catch {
            return { ...token, balance: 0 };
          }
        })
      );

      setTokenBalances(refreshedTokens);
      setRecipient("");
      setAmount("");
      setRecentTxs((prev) => [
        { type: "Sent", asset: selectedAsset, amount: `-${amount}`, date: "Just now" },
        ...prev,
      ]);
    } catch (error) {
      console.error(error);
      setStatus("Transaction failed. Please check wallet and network.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #020817, #0f172a)", color: "#e2e8f0", fontFamily: "Arial, sans-serif", padding: "30px 18px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 2, color: "#94a3b8", textTransform: "uppercase" }}>Portfolio</div>
            <h1 style={{ margin: "8px 0 0", fontSize: 36 }}>Crypto Wallet</h1>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, padding: "10px 16px", color: "#cbd5e1" }}>
              {network || "Unknown network"}
            </div>
            <button onClick={connectWallet} style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "white", border: "none", borderRadius: 12, padding: "12px 18px", fontWeight: "bold", cursor: "pointer" }}>
              {walletAddress ? "Reconnect Wallet" : "Connect Wallet"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 24 }}>
          <div style={{ background: "rgba(15,23,42,0.9)", borderRadius: 24, padding: 24, border: "1px solid rgba(148,163,184,0.15)", boxShadow: "0 25px 50px rgba(0,0,0,0.28)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ color: "#94a3b8", fontSize: 13 }}>Total balance</div>
                <div style={{ fontSize: 44, fontWeight: "bold", marginTop: 10 }}>{formatCurrency(portfolioValue)}</div>
              </div>
              <div style={{ background: "rgba(34,197,94,0.1)", color: "#86efac", border: "1px solid rgba(134,239,172,0.3)", borderRadius: 999, padding: "10px 14px", fontWeight: "bold" }}>
                +12.4% this month
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginTop: 28 }}>
              <div style={{ background: "rgba(148,163,184,0.08)", borderRadius: 18, padding: 18 }}>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>ETH Balance</div>
                <div style={{ fontSize: 28, fontWeight: "bold", marginTop: 8 }}>{balance.toFixed(4)} ETH</div>
              </div>
              <div style={{ background: "rgba(148,163,184,0.08)", borderRadius: 18, padding: 18 }}>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>Income</div>
                <div style={{ fontSize: 28, fontWeight: "bold", marginTop: 8, color: "#4ade80" }}>$18.2k</div>
              </div>
              <div style={{ background: "rgba(148,163,184,0.08)", borderRadius: 18, padding: 18 }}>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>Spending</div>
                <div style={{ fontSize: 28, fontWeight: "bold", marginTop: 8, color: "#f87171" }}>$7.5k</div>
              </div>
            </div>

            <div style={{ marginTop: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0 }}>Assets</h3>
                <button onClick={copyAddress} style={{ background: "rgba(255,255,255,0.04)", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", cursor: "pointer" }}>
                  Copy address
                </button>
              </div>

              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 18, padding: 10 }}>
                {[
                  { symbol: "ETH", balance, price: 3500 },
                  ...tokenBalances,
                ].map((asset) => (
                  <div key={asset.symbol} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 12px", borderBottom: "1px solid rgba(148,163,184,0.12)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: asset.symbol === "ETH" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : asset.symbol === "USDC" ? "linear-gradient(135deg,#22c55e,#16a34a)" : asset.symbol === "USDT" ? "linear-gradient(135deg,#34d399,#10b981)" : "linear-gradient(135deg,#f59e0b,#f97316)", fontWeight: "bold" }}>
                        {asset.symbol.slice(0, 1)}
                      </div>
                      <div>
                        <div style={{ fontWeight: "bold" }}>{asset.symbol}</div>
                        <div style={{ color: "#94a3b8", fontSize: 12 }}>{asset.balance?.toFixed?.(asset.symbol === "ETH" ? 4 : 2) ?? 0}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: "bold" }}>{formatCurrency((asset.balance || 0) * (asset.price || 1))}</div>
                      <div style={{ color: "#94a3b8", fontSize: 12 }}>${(asset.price || 1).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: "rgba(15,23,42,0.9)", borderRadius: 24, padding: 24, border: "1px solid rgba(148,163,184,0.15)", boxShadow: "0 25px 50px rgba(0,0,0,0.28)" }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Send money</h3>

            <label style={{ display: "block", marginTop: 16, color: "#94a3b8" }}>Asset</label>
            <select value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value)} style={{ width: "100%", marginTop: 8, background: "rgba(15,23,42,0.7)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, color: "white", padding: "12px 14px" }}>
              <option value="ETH">ETH</option>
              {tokenBalances.map((token) => (
                <option key={token.symbol} value={token.symbol}>{token.symbol}</option>
              ))}
            </select>

            <label style={{ display: "block", marginTop: 16, color: "#94a3b8" }}>Recipient</label>
            <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0xA1b2..." style={{ width: "100%", marginTop: 8, background: "rgba(15,23,42,0.7)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, color: "white", padding: "12px 14px" }} />

            <label style={{ display: "block", marginTop: 16, color: "#94a3b8" }}>Amount</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.0001" min="0" placeholder="0.01" style={{ width: "100%", marginTop: 8, background: "rgba(15,23,42,0.7)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, color: "white", padding: "12px 14px" }} />

            <button onClick={sendTransaction} disabled={loading || !walletAddress} style={{ width: "100%", marginTop: 22, background: loading ? "#64748b" : "linear-gradient(135deg, #22c55e, #16a34a)", color: "white", border: "none", borderRadius: 12, padding: "14px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Sending..." : `Send ${selectedAsset}`}
            </button>

            {status && <div style={{ marginTop: 16, color: status.toLowerCase().includes("failed") ? "#fca5a5" : "#86efac" }}>{status}</div>}

            {txHash && (
              <div style={{ marginTop: 18, wordBreak: "break-all" }}>
                <div style={{ color: "#94a3b8", marginBottom: 6 }}>Transaction Hash</div>
                <a href={`${ETHERSCAN_URL}/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>{txHash}</a>
              </div>
            )}

            <div style={{ marginTop: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Recent activity</h3>
                <span style={{ color: "#94a3b8", fontSize: 12 }}>Live</span>
              </div>

              {recentTxs.map((tx, index) => (
                <div key={`${tx.asset}-${index}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(148,163,184,0.12)" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: tx.type === "Received" ? "#22c55e" : "#f97316" }} />
                    <div>
                      <div style={{ fontWeight: "bold" }}>{tx.type} {tx.asset}</div>
                      <div style={{ color: "#94a3b8", fontSize: 12 }}>{tx.date}</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: "bold", color: tx.type === "Received" ? "#4ade80" : "#facc15" }}>{tx.amount}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, background: "rgba(15,23,42,0.9)", borderRadius: 24, padding: 24, border: "1px solid rgba(148,163,184,0.15)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>Wallet</div>
              <div style={{ fontWeight: "bold", wordBreak: "break-all" }}>{walletAddress ? formatAddress(walletAddress) : "Not connected"}</div>
            </div>
            <div style={{ color: "#94a3b8" }}>Network: {network || "Not available"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;


















































































