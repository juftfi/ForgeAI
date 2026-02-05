/**
 * 同步元数据文件到链上数据
 *
 * 此脚本会:
 * 1. 扫描所有已铸造的 token
 * 2. 读取链上的 houseId
 * 3. 更新元数据文件的 House 属性以匹配链上数据
 *
 * 用法: npx tsx src/scripts/syncMetadataToChain.ts [--dry-run]
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

const BSC_RPC = 'https://bsc-dataseed1.binance.org';
const CONTRACT_ADDRESS = '0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f';

const ABI = [
  'function totalSupply() view returns (uint256)',
  'function getLineage(uint256 tokenId) view returns (tuple(uint256 parent1, uint256 parent2, uint256 generation, uint8 houseId, bool sealed))',
  'function ownerOf(uint256 tokenId) view returns (address)',
];

// House ID 到名称的映射
const HOUSE_ID_TO_NAME: Record<number, string> = {
  1: 'CLEAR',
  2: 'MONSOON',
  3: 'THUNDER',
  4: 'FROST',
  5: 'AURORA',
  6: 'SAND',
  7: 'ECLIPSE',
};

// 元数据目录
const METADATA_DIR = path.resolve(__dirname, '../../../assets/metadata');

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface SyncResult {
  tokenId: number;
  chainHouse: string;
  metaHouse: string;
  updated: boolean;
  error?: string;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('\n' + '='.repeat(70));
  console.log('🔄 元数据同步工具 - 以链上数据为准');
  console.log('='.repeat(70));
  console.log(`模式: ${dryRun ? '🔍 预览模式 (不修改文件)' : '✏️  实际修改模式'}`);
  console.log(`合约: ${CONTRACT_ADDRESS}`);
  console.log(`元数据目录: ${METADATA_DIR}`);
  console.log('='.repeat(70) + '\n');

  const provider = new ethers.JsonRpcProvider(BSC_RPC);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  // 获取总供应量
  const totalSupply = await contract.totalSupply();
  console.log(`📊 当前总供应量: ${totalSupply}\n`);

  if (Number(totalSupply) === 0) {
    console.log('没有已铸造的 token，无需同步。');
    return;
  }

  const results: SyncResult[] = [];
  let updated = 0;
  let matched = 0;
  let errors = 0;

  console.log('⏳ 开始扫描并同步...\n');

  // 批量处理
  const BATCH_SIZE = 5;
  const total = Number(totalSupply);

  for (let i = 1; i <= total; i += BATCH_SIZE) {
    const batch: Promise<SyncResult>[] = [];

    for (let j = i; j < Math.min(i + BATCH_SIZE, total + 1); j++) {
      batch.push(processToken(contract, j, dryRun));
    }

    const batchResults = await Promise.all(batch);

    for (const result of batchResults) {
      results.push(result);

      if (result.error) {
        errors++;
      } else if (result.updated) {
        updated++;
        console.log(`  ✏️  #${result.tokenId}: ${result.metaHouse} → ${result.chainHouse}`);
      } else {
        matched++;
      }
    }

    // 显示进度
    process.stdout.write(`\r  进度: ${Math.min(i + BATCH_SIZE - 1, total)}/${total}`);

    // 短暂延迟避免 RPC 限速
    await delay(200);
  }

  console.log('\n\n' + '='.repeat(70));
  console.log('📈 同步结果:');
  console.log('='.repeat(70));
  console.log(`  已匹配 (无需修改): ${matched}`);
  console.log(`  已更新: ${updated}`);
  console.log(`  错误: ${errors}`);

  // 显示详细的修改列表
  const updatedResults = results.filter(r => r.updated);
  if (updatedResults.length > 0) {
    console.log('\n📋 修改详情:');
    console.log('-'.repeat(70));
    for (const r of updatedResults) {
      console.log(`  Token #${r.tokenId}: ${r.metaHouse} → ${r.chainHouse}`);
    }
  }

  // 显示错误列表
  const errorResults = results.filter(r => r.error);
  if (errorResults.length > 0) {
    console.log('\n⚠️  错误列表:');
    console.log('-'.repeat(70));
    for (const r of errorResults) {
      console.log(`  Token #${r.tokenId}: ${r.error}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  if (dryRun) {
    console.log('🔍 预览完成。若要实际修改，请去掉 --dry-run 参数重新运行。');
  } else {
    console.log('✅ 同步完成！');
  }
  console.log('='.repeat(70) + '\n');
}

async function processToken(contract: ethers.Contract, tokenId: number, dryRun: boolean): Promise<SyncResult> {
  try {
    // 检查 token 是否存在（通过尝试获取 owner）
    try {
      await contract.ownerOf(tokenId);
    } catch {
      // Token 不存在或已销毁
      return {
        tokenId,
        chainHouse: 'N/A',
        metaHouse: 'N/A',
        updated: false,
        error: 'Token不存在或已销毁',
      };
    }

    // 获取链上数据
    const lineage = await contract.getLineage(tokenId);
    const chainHouseId = Number(lineage.houseId);
    const chainHouse = HOUSE_ID_TO_NAME[chainHouseId] || `Unknown(${chainHouseId})`;

    // 读取元数据文件
    const metaPath = path.join(METADATA_DIR, `${tokenId}.json`);
    if (!fs.existsSync(metaPath)) {
      return {
        tokenId,
        chainHouse,
        metaHouse: 'N/A',
        updated: false,
        error: '元数据文件不存在',
      };
    }

    const metaContent = fs.readFileSync(metaPath, 'utf8');
    const metadata = JSON.parse(metaContent);

    // 查找 House 属性
    const houseAttrIndex = metadata.attributes?.findIndex(
      (a: { trait_type: string }) => a.trait_type === 'House'
    );

    if (houseAttrIndex === -1 || houseAttrIndex === undefined) {
      return {
        tokenId,
        chainHouse,
        metaHouse: 'N/A',
        updated: false,
        error: '元数据中没有House属性',
      };
    }

    const metaHouse = metadata.attributes[houseAttrIndex].value;

    // 检查是否匹配
    if (metaHouse === chainHouse) {
      return {
        tokenId,
        chainHouse,
        metaHouse,
        updated: false,
      };
    }

    // 需要更新
    if (!dryRun) {
      // 更新 House 属性
      metadata.attributes[houseAttrIndex].value = chainHouse;

      // 更新 WeatherID 中的 house 部分 (如果存在)
      const weatherIdIndex = metadata.attributes?.findIndex(
        (a: { trait_type: string }) => a.trait_type === 'WeatherID'
      );
      if (weatherIdIndex !== -1 && weatherIdIndex !== undefined) {
        const oldWeatherId = metadata.attributes[weatherIdIndex].value;
        // WeatherID 格式: S0-HOUSE-XXXX
        const parts = oldWeatherId.split('-');
        if (parts.length >= 2) {
          parts[1] = chainHouse;
          metadata.attributes[weatherIdIndex].value = parts.join('-');
        }
      }

      // 更新 name 字段（如果包含 house 名称）
      if (metadata.name && metadata.name.includes(metaHouse)) {
        metadata.name = metadata.name.replace(metaHouse, chainHouse);
      }

      // 写回文件
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
    }

    return {
      tokenId,
      chainHouse,
      metaHouse,
      updated: true,
    };

  } catch (error: any) {
    return {
      tokenId,
      chainHouse: 'N/A',
      metaHouse: 'N/A',
      updated: false,
      error: error.message || '未知错误',
    };
  }
}

main().catch(console.error);
