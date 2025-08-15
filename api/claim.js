import { ethers } from "ethers";

// ======================
// Konfigurasi
// ======================
const CONTRACT_ADDRESS = "0x811a9c458151b6e7990854013B5FEDB3A5e03608";
const API_KEY = process.env.API_KEY;


//
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

// ABI
const ABI = [
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  { "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "address", "name": "recipient", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "time", "type": "uint256" }
    ], "name": "Claimed", "type": "event"
  },
  { "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ], "name": "Funded", "type": "event"
  },
  { "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }
    ], "name": "OwnerChanged", "type": "event"
  },
  { "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ], "name": "Withdrawn", "type": "event"
  },
  { "inputs": [], "name": "COOLDOWN", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }], "name": "changeOwner", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [
      { "internalType": "address", "name": "recipient", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ], "name": "claim", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  { "inputs": [{ "internalType": "address", "name": "player", "type": "address" }], "name": "getLastClaim", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "lastClaim", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "stateMutability": "payable", "type": "receive" }
];

// ======================
// Helper
// ======================
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*"); // atau batasi ke domain game kamu
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
}

function badRequest(res, msg, code = 400) {
  return res.status(code).json({ error: msg });
}

function parseAmountToWei(scoreMon) {
  // Score dikirim dari game dalam MON (0.1 kelipatan, maks 5.0)
  // Asumsi 18 desimal (seperti ETH).
  // Clamp safety
  const n = Number(scoreMon);
  if (!Number.isFinite(n)) throw new Error("Invalid score");
  if (n <= 0) throw new Error("Score must be > 0");
  if (n > 5) throw new Error("Score exceeds max");
  // Jaga precision: toFixed(1) karena game naik 0.1
  return ethers.parseUnits(n.toFixed(1), 18);
}

async function getContract() {
  const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}

// ======================
// Handler
// ======================
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method !== "POST") {
      return badRequest(res, "Method not allowed", 405);
    }

    // Verifikasi API key sederhana
    const key = req.headers["x-api-key"];
    if (!key || key !== API_KEY) {
      return badRequest(res, "Invalid API key", 401);
    }

    const { wallet, recipient, score, amount } = req.body || {};
    const target = (wallet || recipient || "").toString().trim();

    if (!target) return badRequest(res, "Missing recipient/wallet");
    if (score === undefined && amount === undefined) {
      return badRequest(res, "Missing score/amount");
    }

    // Normalisasi address + validasi
    let recipientAddr;
    try {
      recipientAddr = ethers.getAddress(target);
    } catch {
      return badRequest(res, "Invalid wallet address");
    }

    // Cek whitelist
    if (!WHITELIST.includes(recipientAddr.toLowerCase())) {
      return badRequest(res, "Wallet ini belum masuk whitelist", 403);
    }

    //
    let amountWei;
    if (score !== undefined) {
      amountWei = parseAmountToWei(score);
    } else {
      try {
        amountWei = BigInt(amount);
      } catch {
        return badRequest(res, "Invalid amount");
      }
    }

    const contract = await getContract();

    // cooldown
    const [lastClaim, cooldown] = await Promise.all([
      contract.getLastClaim(recipientAddr),
      contract.COOLDOWN()
    ]);

    const now = Math.floor(Date.now() / 1000);
    const nextAllowed = Number(lastClaim) + Number(cooldown);
    if (now < nextAllowed) {
      const wait = nextAllowed - now;
      return badRequest(res, `Cooldown aktif. Coba lagi dalam ${Math.ceil(wait / 60)} menit.`);
    }

    // Cek
    const provider = contract.runner.provider;
    const balance = await provider.getBalance(CONTRACT_ADDRESS);
    if (balance < amountWei) {
      return badRequest(res, "Saldo pool tidak cukup, harap isi dana terlebih dahulu");
    }

    // claim
    const tx = await contract.claim(recipientAddr, amountWei);
    const receipt = await tx.wait();

    return res.status(200).json({
      success: true,
      txHash: receipt.hash || receipt.transactionHash,
      recipient: recipientAddr,
      amountWei: amountWei.toString()
    });

  } catch (err) {
    console.error("claim error:", err);
    // ethers v6 error format
    const msg = err?.shortMessage || err?.reason || err?.message || "Unknown error";
    return res.status(500).json({ error: msg });
  }
}
