import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

const provider = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org');
const contract = new ethers.Contract('0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f', [
  'function getLineage(uint256 tokenId) view returns (tuple(uint256 parent1, uint256 parent2, uint256 generation, uint8 houseId, bool sealed))',
  'function totalSupply() view returns (uint256)'
], provider);

const HOUSES = ['', 'CLEAR', 'MONSOON', 'THUNDER', 'FROST', 'AURORA', 'SAND', 'ECLIPSE'];

async function main() {
  console.log('比较链上数据与元数据文件...\n');

  const totalSupply = await contract.totalSupply();
  console.log(`当前总供应量: ${totalSupply}\n`);

  const mismatches: { tokenId: number; chainHouse: string; metaHouse: string }[] = [];

  // 检查前 10 个已铸造的 token
  const tokensToCheck = [1, 10, 50, 100, 150, 200];

  for (const id of tokensToCheck) {
    try {
      const lineage = await contract.getLineage(id);
      const chainHouseId = Number(lineage.houseId);
      const chainHouse = HOUSES[chainHouseId] || `Unknown(${chainHouseId})`;

      // 读取元数据文件
      const metaPath = path.join(process.cwd(), '..', 'assets', 'metadata', `${id}.json`);
      const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const metaHouse = metaData.attributes.find((a: any) => a.trait_type === 'House')?.value || 'N/A';
      const metaRarity = metaData.attributes.find((a: any) => a.trait_type === 'RarityTier')?.value || 'N/A';

      const match = chainHouse === metaHouse ? '✅' : '❌ 不匹配!';

      console.log(`Token #${id}:`);
      console.log(`  链上 House: ${chainHouse} (ID: ${chainHouseId})`);
      console.log(`  元数据 House: ${metaHouse}`);
      console.log(`  元数据 Rarity: ${metaRarity}`);
      console.log(`  状态: ${match}`);
      console.log('');

      if (chainHouse !== metaHouse) {
        mismatches.push({ tokenId: id, chainHouse, metaHouse });
      }
    } catch (e: any) {
      console.log(`Token #${id}: 错误 - ${e.message}\n`);
    }
  }

  if (mismatches.length > 0) {
    console.log('='.repeat(50));
    console.log('⚠️  发现数据不匹配:');
    for (const m of mismatches) {
      console.log(`  Token #${m.tokenId}: 链上=${m.chainHouse}, 元数据=${m.metaHouse}`);
    }
    console.log('='.repeat(50));
  }
}

main();
