// api/claim.js
// Serverless function untuk Vercel

import { ethers } from "ethers";


// ============
// WHITELIST
// ============
const WHITELIST = [
  "0x348c6a77fd9715ad6747a2cfa8b6b35e87361a84",
  "0xF9BBb61b3AeebA22F2cE75f527F737B329280E3A",
  "0xFa9Cca5C0D1827e22bbeFDd1b2d5b9CdD40c10A5",
  "0x458aac1ae5f9ea01cac3157c2df518ea3537cf50",
  "0xCCFc719De63B5a30EC497D369B6cF941593BA4bF",
  "0x9c5Ce00F04c5c7AE30323DEed5C696d5cd47a0b6",
  "0x7f65DE72754CC8480f936bEE490bC41f8b6e92fb",
  "0x92C2a6A52b7Bb3d4BB71C8E0568aEa0D388298C7",
  "0xBF3d4a0c59fFc16D6B9fFe209A8799D41b6541b5",
  "0x52752f927887bafe780f8e04841f011a5df8846d",
  "0x0Dc3f744A15c18550CAf04B5b4184aE866caF22f",
  "0x9BAb3F6fFcB6c8B3d229cae1e1DBad2F0151229D",
].map(a => a.toLowerCase());

// =====
// ABI
// =====
const ABI = [
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  {
    "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "address", "name": "recipient", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "time", "type": "uint256" }
    ],
    "name": "Claimed", "type": "event"
  },
  {
    "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "Funded", "type": "event"
  },
  {
    "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }
    ],
    "name": "OwnerChanged", "type": "event"
  },
  {
    "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "Withdrawn", "type": "event"
  },
  { "inputs": [], "name": "COOLDOWN", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }], "name": "changeOwner", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "recipient", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "claim", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getLastClaim", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "lastClaim", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "stateMutability": "payable", "type": "receive" }
];

// =====================
// Util: CORS & Helpers
// =====================
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*"); // kalau mau spesifik, ganti ke domain game kamu
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
}

function monToWei(mon) {
  // Asumsi native token 18 desimal. Jika token berbeda, sesuaikan multiplier.
  // 0.1 MON -> 0.1 * 1e18 wei
  return ethers.parseUnits(mon.toFixed(18), 18);
}

function parseAmountFromBody(body) {
  // Terima dua skenario:
  // 1) Frontend kirim { wallet, score }  -> convert score (MON) ke amount (wei)
  // 2) Frontend kirim { recipient, amount } -> pakai langsung amount (wei)
  if (body && typeof body.score === "number") {
    const mon = Math.max(0, Math.min(5, body.score)); // clamp 0..5
    return monToWei(mon);
  }
  if (body && typeof body.amount !== "undefined") {
    // amount sudah dalam wei (string/number)
    return BigInt(body.amount.toString());
  }
  return null;
}

// =====================
// Serverless Handler
// =====================
export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // API Key check (opsional tapi disarankan)
    const key = req.headers["x-api-key"];
    if (API_KEY && key !== API_KEY) {
      return res.status(401).json({ error: "Unauthorized: invalid API key" });
    }

    const body = req.body || {};
    // Terima field wallet/recipient (alias)
    const recipient =
      (body.wallet && String(body.wallet)) ||
      (body.recipient && String(body.recipient));
    if (!recipient) {
      return res.status(400).json({ error: "Missing wallet/recipient" });
    }

    // Whitelist check
    if (!WHITELIST.includes(recipient.toLowerCase())) {
      return res.status(403).json({ error: "Wallet ini belum masuk whitelist" });
    }

    // Hitung amount
    const amount = parseAmountFromBody(body);
    if (!amount || amount <= 0n) {
      return res.status(400).json({ error: "Invalid amount/score" });
    }

    // Ethers setup
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

    // Cooldown check (di kontrak + pre-check di backend)
    const [lastClaimBn, cooldownBn] = await Promise.all([
      contract.getLastClaim(recipient),
      contract.COOLDOWN()
    ]);

    const now = Math.floor(Date.now() / 1000);
    const last = Number(lastClaimBn);
    const cd = Number(cooldownBn);
    const nextAllowed = last + cd;

    if (cd > 0 && now < nextAllowed) {
      const waitSec = nextAllowed - now;
      // Tampilkan sisa waktu jam/menit
      const h = Math.floor(waitSec / 3600);
      const m = Math.floor((waitSec % 3600) / 60);
      const s = waitSec % 60;
      return res.status(400).json({
        error: `Cooldown aktif. Coba lagi dalam ${h}j ${m}m ${s}d`
      });
    }

    // Kirim transaksi claim
    // (opsional) atur gasLimit manual jika perlu: { gasLimit: 120000 }
    const tx = await contract.claim(recipient, amount);
    const receipt = await tx.wait();

    return res.status(200).json({
      ok: true,
      txHash: receipt.hash
    });

  } catch (err) {
    // Tangani CALL_EXCEPTION dan error umum lain
    const msg = err?.shortMessage || err?.message || "Unknown error";
    return res.status(500).json({ error: msg });
  }
}
