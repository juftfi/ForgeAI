/**
 * 查询钱包铸造情况脚本
 * 用法: npx tsx src/scripts/checkWallet.ts <钱包地址>
 */

import { ethers } from 'ethers';

// BSC 主网配置
const BSC_RPC = 'https://bsc-dataseed1.binance.org';
const CONTRACT_ADDRESS = '0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f';

// 合约 ABI (只包含需要的函数)
const ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function getAgentMetadata(uint256 tokenId) view returns (tuple(string persona, string experience, string vaultURI, bytes32 vaultHash, bytes32 learningRoot, uint256 learningVersion, uint256 lastLearningUpdate))',
  'function getLineage(uint256 tokenId) view returns (tuple(uint256 parent1, uint256 parent2, uint256 generation, uint8 houseId, bool sealed))',
];

// 家族名称映射
const HOUSE_NAMES: Record<number, string> = {
  1: '☀️ Solara (晴阳家族)',
  2: '🌧️ Nimbus (雨云家族)',
  3: '❄️ Glacier (冰霜家族)',
  4: '⛈️ Tempest (雷暴家族)',
  5: '🌫️ Mistral (迷雾家族)',
  6: '🌈 Prism (彩虹家族)',
  7: '🌀 Vortex (旋风家族)',
};

// 延迟函数，避免 RPC 限速
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const walletAddress = process.argv[2];

  if (!walletAddress) {
    console.log('用法: npx tsx src/scripts/checkWallet.ts <钱包地址>');
    console.log('示例: npx tsx src/scripts/checkWallet.ts 0x1234...');
    process.exit(1);
  }

  // 验证地址格式
  if (!ethers.isAddress(walletAddress)) {
    console.error('❌ 无效的钱包地址');
    process.exit(1);
  }

  const normalizedAddress = walletAddress.toLowerCase();
  const provider = new ethers.JsonRpcProvider(BSC_RPC);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  console.log('\n' + '='.repeat(60));
  console.log('🔍 KinForge 钱包查询工具');
  console.log('='.repeat(60));
  console.log(`📍 合约地址: ${CONTRACT_ADDRESS}`);
  console.log(`👛 查询钱包: ${walletAddress}`);
  console.log('='.repeat(60) + '\n');

  try {
    // 查询总供应量
    const totalSupply = await contract.totalSupply();
    console.log(`📊 当前总铸造量: ${totalSupply.toString()} / 2100\n`);

    // 查询钱包余额
    const balance = await contract.balanceOf(walletAddress);
    console.log(`💰 该钱包持有: ${balance.toString()} 个智能体\n`);

    if (balance === 0n) {
      console.log('该钱包暂未持有任何 KinForge 智能体。');
      return;
    }

    console.log('⏳ 正在扫描所有 token，请稍候...\n');

    // 遍历所有 token 查找该钱包持有的
    const ownedTokenIds: number[] = [];
    const total = Number(totalSupply);

    // 批量查询，每批 10 个
    const BATCH_SIZE = 10;
    for (let i = 1; i <= total; i += BATCH_SIZE) {
      const batch: Promise<{ tokenId: number; owner: string } | null>[] = [];

      for (let j = i; j < Math.min(i + BATCH_SIZE, total + 1); j++) {
        batch.push(
          contract.ownerOf(j)
            .then((owner: string) => ({ tokenId: j, owner: owner.toLowerCase() }))
            .catch(() => null)
        );
      }

      const results = await Promise.all(batch);
      for (const result of results) {
        if (result && result.owner === normalizedAddress) {
          ownedTokenIds.push(result.tokenId);
        }
      }

      // 显示进度
      process.stdout.write(`\r  扫描进度: ${Math.min(i + BATCH_SIZE - 1, total)}/${total}`);

      // 短暂延迟避免限速
      await delay(100);
    }

    console.log('\n');

    if (ownedTokenIds.length === 0) {
      console.log('该钱包暂未持有任何 KinForge 智能体。');
      return;
    }

    // 遍历钱包持有的所有 token
    console.log('-'.repeat(60));
    console.log('📋 持有的智能体列表:');
    console.log('-'.repeat(60));

    const tokens: Array<{
      tokenId: number;
      houseId: number;
      generation: number;
      sealed: boolean;
      learningVersion: number;
      parent1: string;
      parent2: string;
    }> = [];

    for (const tokenId of ownedTokenIds) {
      try {
        const [lineage, metadata] = await Promise.all([
          contract.getLineage(tokenId),
          contract.getAgentMetadata(tokenId),
        ]);

        // learningVersion 可能是大数，安全转换
        let learningVer = 0;
        try {
          const lv = metadata.learningVersion;
          learningVer = lv > BigInt(Number.MAX_SAFE_INTEGER) ? 0 : Number(lv);
        } catch {
          learningVer = 0;
        }

        tokens.push({
          tokenId,
          houseId: Number(lineage.houseId),
          generation: Number(lineage.generation),
          sealed: Boolean(lineage.sealed),
          learningVersion: learningVer,
          parent1: lineage.parent1.toString(),
          parent2: lineage.parent2.toString(),
        });

        await delay(50);
      } catch (e) {
        console.log(`  #${tokenId} - 无法获取信息`);
      }
    }

    // 按 tokenId 排序
    tokens.sort((a, b) => a.tokenId - b.tokenId);

    // 统计信息
    const stats = {
      genesis: 0,
      offspring: 0,
      sealed: 0,
      byHouse: new Map<number, number>(),
    };

    for (const token of tokens) {
      const houseName = HOUSE_NAMES[token.houseId] || `未知家族 (${token.houseId})`;
      const genLabel = token.generation === 0 ? '🌟 创世' : `🧬 第${token.generation}代`;
      const sealedLabel = token.sealed ? '🔒 已封印' : '';
      const learningLabel = token.learningVersion > 0 ? `📚 v${token.learningVersion}` : '';
      const parentLabel = token.generation > 0 ? `(父母: #${token.parent1} + #${token.parent2})` : '';

      console.log(`\n  #${token.tokenId.toString().padStart(4, '0')} | ${houseName}`);
      console.log(`         ${genLabel} ${sealedLabel} ${learningLabel} ${parentLabel}`.trim());

      // 统计
      if (token.generation === 0) stats.genesis++;
      else stats.offspring++;
      if (token.sealed) stats.sealed++;

      const houseCount = stats.byHouse.get(token.houseId) || 0;
      stats.byHouse.set(token.houseId, houseCount + 1);
    }

    // 输出统计摘要
    console.log('\n' + '-'.repeat(60));
    console.log('📈 统计摘要:');
    console.log('-'.repeat(60));
    console.log(`  创世智能体: ${stats.genesis}`);
    console.log(`  后代智能体: ${stats.offspring}`);
    console.log(`  已封印: ${stats.sealed}`);
    console.log('\n  家族分布:');

    const sortedHouses = Array.from(stats.byHouse.entries()).sort((a, b) => a[0] - b[0]);
    for (const [houseId, count] of sortedHouses) {
      const name = HOUSE_NAMES[houseId] || `未知家族 (${houseId})`;
      console.log(`    ${name}: ${count}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ 查询完成');
    console.log('='.repeat(60) + '\n');

  } catch (error: any) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  }
}

main();
