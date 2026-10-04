import { useEffect, useState } from "react";
import { ethers } from "ethers";

const ETHERSCAN_URL = "https://sepolia.etherscan.io";

function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [balance, setBalance] = useState("0");
  const [network, setNetwork] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");

  const refreshBalance = async (account, provider) => {
    try {
      const rawBalance = await provider.getBalance(account);
      const formattedBalance = ethers.formatEther(rawBalance);
      setBalance(formattedBalance);
    } catch (error) {
      console.error("Balance fetch failed:", error);
      setStatus("Unable to fetch balance.");
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      setStatus("MetaMask is not installed.");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const account = accounts[0];
      const networkInfo = await provider.getNetwork();

      setWalletAddress(account);
      setNetwork(networkInfo.name || "Unknown network");
      await refreshBalance(account, provider);
      setStatus("Wallet connected successfully.");
    } catch (error) {
      console.error(error);
      setStatus("Wallet connection failed.");
    }
  };

  useEffect(() => {
    const autoConnect = async () => {
      if (!window.ethereum) return;
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_accounts", []);
        if (accounts && accounts.length) {
          const account = accounts[0];
          const networkInfo = await provider.getNetwork();
          setWalletAddress(account);
          setNetwork(networkInfo.name || "Unknown network");
          await refreshBalance(account, provider);
        }
      } catch (error) {
        console.error("Auto-connect failed:", error);
      }
    };

    autoConnect();
  }, []);

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
      const tx = await signer.sendTransaction({
        to: recipient,
        value: ethers.parseEther(amount),
      });

      await tx.wait();
      setTxHash(tx.hash);
      setStatus("Transaction sent successfully.");
      const freshBalance = await provider.getBalance(walletAddress);
      setBalance(ethers.formatEther(freshBalance));
      setRecipient("");
      setAmount("");
    } catch (error) {
      console.error(error);
      setStatus("Transaction failed. Please check your wallet and network.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a, #111827)",
      color: "#e2e8f0",
      fontFamily: "Arial, sans-serif",
      padding: "32px 20px"
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ margin: 0 }}>Crypto Wallet</h1>
          <button
            onClick={connectWallet}
            style={{
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              color: "white",
              border: "none",
              borderRadius: 12,
              padding: "12px 18px",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            {walletAddress ? "Reconnect Wallet" : "Connect Wallet"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 24 }}>
          <div style={{ background: "rgba(15,23,42,0.9)", borderRadius: 20, padding: 24, border: "1px solid rgba(148,163,184,0.15)" }}>
            <div style={{ color: "#94a3b8", fontSize: 14 }}>Total Balance</div>
            <div style={{ fontSize: 42, fontWeight: "bold", margin: "10px 0" }}>{Number(balance).toFixed(4)} ETH</div>
            <div style={{ color: "#22c55e", marginBottom: 20 }}>+12.4% this month</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 18 }}>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>Income</div>
                <div style={{ fontSize: 28, fontWeight: "bold", marginTop: 10, color: "#4ade80" }}>$18.2k</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 18 }}>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>Expense</div>
                <div style={{ fontSize: 28, fontWeight: "bold", marginTop: 10, color: "#f87171" }}>$7.5k</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 18 }}>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>Net</div>
                <div style={{ fontSize: 28, fontWeight: "bold", marginTop: 10 }}>$10.7k</div>
              </div>
            </div>

            <div style={{ marginTop: 28 }}>
              <div style={{ color: "#94a3b8", marginBottom: 12 }}>Wallet Address</div>
              <div style={{ wordBreak: "break-all", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 12 }}>
                {walletAddress || "Not connected"}
              </div>
              <div style={{ marginTop: 12, color: "#94a3b8" }}>Network: {network || "Not available"}</div>
            </div>
          </div>

          <div style={{ background: "rgba(15,23,42,0.9)", borderRadius: 20, padding: 24, border: "1px solid rgba(148,163,184,0.15)" }}>
            <h3 style={{ marginTop: 0 }}>Send ETH</h3>

            <label style={{ display: "block", marginTop: 16, color: "#94a3b8" }}>Recipient</label>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0xA1b2..."
              style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.7)", color: "white", padding: "12px 14px", marginTop: 8 }}
            />

            <label style={{ display: "block", marginTop: 16, color: "#94a3b8" }}>Amount (ETH)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              step="0.0001"
              min="0"
              placeholder="0.01"
              style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.7)", color: "white", padding: "12px 14px", marginTop: 8 }}
            />

            <button
              onClick={sendTransaction}
              disabled={loading || !walletAddress}
              style={{
                width: "100%",
                marginTop: 20,
                background: loading ? "#64748b" : "linear-gradient(135deg, #22c55e, #16a34a)",
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: "14px",
                fontWeight: "bold",
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Sending..." : "Send ETH"}
            </button>

            {status && <div style={{ marginTop: 18, color: status.includes("failed") || status.includes("failed") ? "#fca5a5" : "#86efac" }}>{status}</div>}

            {txHash && (
              <div style={{ marginTop: 18, wordBreak: "break-all" }}>
                <div style={{ color: "#94a3b8", marginBottom: 6 }}>Transaction Hash</div>
                <a
                  href={`${ETHERSCAN_URL}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#60a5fa" }}
                >
                  {txHash}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;











































































