/**
 * Polymarket to Irys Upload Script
 * 
 * This script fetches resolved Polymarket markets and uploads them to Irys
 * for permanent, verifiable on-chain storage.
 * 
 * Prerequisites:
 * 1. npm install @irys/upload @irys/upload-ethereum axios
 * 2. Set IRYS_PRIVATE_KEY environment variable (Polygon wallet private key)
 * 3. Fund your wallet with MATIC for upload fees
 * 
 * Usage:
 * npx tsx scripts/upload-polymarket-to-irys.ts
 */

import { Uploader } from "@irys/upload";
import { Matic } from "@irys/upload-ethereum";
import axios from "axios";

const PRIVATE_KEY = process.env.IRYS_PRIVATE_KEY!;
const GAMMA_API = "https://gamma-api.polymarket.com";

if (!PRIVATE_KEY) {
  console.error("❌ IRYS_PRIVATE_KEY environment variable is required");
  console.log("Set it with: export IRYS_PRIVATE_KEY=0xYOUR_PRIVATE_KEY");
  process.exit(1);
}

interface PolymarketMarket {
  condition_id: string;
  question: string;
  outcomes: string[];
  end_date_iso: string;
  closed: boolean;
  outcome?: string;
  outcome_prices?: number[];
  volume?: string;
  category?: string;
}

function inferCategory(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("election") || q.includes("president") || q.includes("trump") || q.includes("biden") || q.includes("political") || q.includes("vote")) return "elections";
  if (q.includes("crypto") || q.includes("bitcoin") || q.includes("eth") || q.includes("token") || q.includes("blockchain")) return "crypto";
  if (q.includes("sports") || q.includes("nfl") || q.includes("nba") || q.includes("super bowl") || q.includes("championship")) return "sports";
  if (q.includes("ai") || q.includes("openai") || q.includes("gpt") || q.includes("technology")) return "tech";
  return "other";
}

async function fetchResolvedMarkets(limit = 100): Promise<PolymarketMarket[]> {
  console.log(`📥 Fetching ${limit} resolved markets from Polymarket...`);
  const response = await axios.get(`${GAMMA_API}/markets`, {
    params: { closed: true, limit }
  });
  return response.data;
}

async function main() {
  console.log("🚀 Polymarket → Irys Upload Script");
  console.log("═".repeat(50));
  
  try {
    // Connect to Irys with Polygon/MATIC
    console.log("\n🔗 Connecting to Irys (Polygon network)...");
    const uploader = await Uploader(Matic).withWallet(PRIVATE_KEY);
    console.log(`   Wallet: ${uploader.address}`);
    
    // Check balance
    const balance = await uploader.getBalance();
    const balanceMatic = uploader.utils.fromAtomic(balance);
    console.log(`   Balance: ${balanceMatic} MATIC`);
    
    if (parseFloat(balanceMatic) < 0.01) {
      console.log("\n⚠️  Low balance! Fund your wallet with MATIC for uploads.");
      console.log("   For devnet testing, use: uploader.fund(uploader.utils.toAtomic(0.1))");
    }
    
    // Fetch resolved markets
    const markets = await fetchResolvedMarkets(100);
    console.log(`   Found ${markets.length} resolved markets\n`);
    
    // Estimate total cost
    const totalSize = markets.reduce((sum, m) => sum + JSON.stringify(m).length, 0);
    const price = await uploader.getPrice(totalSize);
    console.log(`💰 Estimated cost: ${uploader.utils.fromAtomic(price)} MATIC`);
    console.log(`   Total data size: ${(totalSize / 1024).toFixed(2)} KB\n`);
    
    // Category breakdown
    const categories = {
      elections: 0,
      crypto: 0,
      sports: 0,
      tech: 0,
      other: 0
    };
    markets.forEach(m => {
      const cat = inferCategory(m.question) as keyof typeof categories;
      categories[cat]++;
    });
    console.log("📊 Categories:");
    Object.entries(categories).forEach(([cat, count]) => {
      if (count > 0) console.log(`   ${cat}: ${count}`);
    });
    console.log();
    
    // Upload each market
    console.log("📤 Uploading to Irys...\n");
    let uploaded = 0;
    let failed = 0;
    const txIds: string[] = [];
    
    for (const market of markets) {
      try {
        const tags = [
          { name: "application-id", value: "polymarket" },
          { name: "Content-Type", value: "application/json" },
          { name: "category", value: market.category || inferCategory(market.question) },
          { name: "status", value: "resolved" },
          { name: "market-id", value: market.condition_id }
        ];
        
        if (market.outcome_prices?.[0]) {
          tags.push({ name: "final-price", value: market.outcome_prices[0].toString() });
        }
        
        const receipt = await uploader.upload(JSON.stringify(market), { tags });
        txIds.push(receipt.id);
        uploaded++;
        
        const shortQuestion = market.question.slice(0, 45) + (market.question.length > 45 ? '...' : '');
        console.log(`✅ ${uploaded}/${markets.length}: ${shortQuestion}`);
        console.log(`   → https://gateway.irys.xyz/${receipt.id}`);
        
        // Rate limit to avoid overwhelming the network
        await new Promise(r => setTimeout(r, 500));
        
      } catch (err: any) {
        failed++;
        console.error(`❌ Failed: ${market.question.slice(0, 30)}... - ${err.message}`);
      }
    }
    
    // Summary
    console.log("\n" + "═".repeat(50));
    console.log("📊 Upload Complete!");
    console.log(`   ✅ Uploaded: ${uploaded}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📁 Transaction IDs saved\n`);
    
    // Save transaction IDs to file for reference
    if (txIds.length > 0) {
      const fs = await import('fs');
      const outputPath = './irys-upload-results.json';
      fs.writeFileSync(outputPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        wallet: uploader.address,
        uploaded,
        failed,
        txIds
      }, null, 2));
      console.log(`   Results saved to: ${outputPath}`);
    }
    
    console.log("\n🔍 Query these markets with:");
    console.log('   curl -X POST https://uploader.irys.xyz/graphql \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"query": "{ transactions(tags: [{name: \\"application-id\\", values: [\\"polymarket\\"]}]) { edges { node { id } } } }"}\'');
    
  } catch (error: any) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);
