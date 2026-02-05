/**
 * 检查交易详情脚本
 */

import { ethers } from 'ethers';

const BSC_RPC = 'https://bsc-dataseed1.binance.org';
const AGENT_ADDRESS = '0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f';
const FUSION_ADDRESS = '0xa62E109Db724308FEB530A0b00431cf47BBC1f6E';

const AGENT_ABI = [
  'function getLineage(uint256 tokenId) view returns (tuple(uint256 parent1, uint256 parent2, uint256 generation, uint8 houseId, bool sealed))',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event GenesisMinted(uint256 indexed tokenId, address indexed owner, uint8 houseId)',
  'event OffspringMinted(uint256 indexed tokenId, address indexed owner, uint256 parent1, uint256 parent2, uint8 houseId, uint256 generation)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

const FUSION_ABI = [
  'event FusionCommitted(address indexed user, uint256 indexed parentA, uint256 indexed parentB, bytes32 commitHash)',
  'event FusionRevealed(address indexed user, uint256 indexed parentA, uint256 indexed parentB, uint256 newTokenId, uint8 mode)',
];

async function main() {
  const txHash = process.argv[2] || '0x7df2e44ee9e9f4bbd966f72cf0ff38bfd7b6b4f2d34f455de33bf87b8f0ab280';

  const provider = new ethers.JsonRpcProvider(BSC_RPC);

  console.log('\n' + '='.repeat(70));
  console.log('🔍 交易分析工具');
  console.log('='.repeat(70));
  console.log(`📋 交易哈希: ${txHash}`);
  console.log('='.repeat(70) + '\n');

  try {
    // 获取交易和收据
    const [tx, receipt] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
    ]);

    if (!tx || !receipt) {
      console.log('❌ 交易未找到');
      return;
    }

    console.log('📍 基本信息:');
    console.log(`  发送者: ${tx.from}`);
    console.log(`  目标合约: ${tx.to}`);
    console.log(`  区块号: ${receipt.blockNumber}`);
    console.log(`  状态: ${receipt.status === 1 ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  Gas 使用: ${receipt.gasUsed.toString()}`);

    // 解析事件
    const agentIface = new ethers.Interface(AGENT_ABI);
    const fusionIface = new ethers.Interface(FUSION_ABI);

    console.log('\n📜 事件日志:');
    console.log('-'.repeat(70));

    for (const log of receipt.logs) {
      try {
        // 尝试解析为 Agent 合约事件
        if (log.address.toLowerCase() === AGENT_ADDRESS.toLowerCase()) {
          const parsed = agentIface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed) {
            console.log(`\n  🔷 ${parsed.name} (Agent合约)`);
            if (parsed.name === 'GenesisMinted') {
              console.log(`     Token ID: ${parsed.args.tokenId}`);
              console.log(`     Owner: ${parsed.args.owner}`);
              console.log(`     House ID: ${parsed.args.houseId}`);
            } else if (parsed.name === 'OffspringMinted') {
              console.log(`     Token ID: ${parsed.args.tokenId}`);
              console.log(`     Owner: ${parsed.args.owner}`);
              console.log(`     Parent 1: ${parsed.args.parent1}`);
              console.log(`     Parent 2: ${parsed.args.parent2}`);
              console.log(`     House ID: ${parsed.args.houseId}`);
              console.log(`     Generation: ${parsed.args.generation}`);
            } else if (parsed.name === 'Transfer') {
              console.log(`     From: ${parsed.args.from}`);
              console.log(`     To: ${parsed.args.to}`);
              console.log(`     Token ID: ${parsed.args.tokenId}`);
            }
          }
        }

        // 尝试解析为 Fusion 合约事件
        if (log.address.toLowerCase() === FUSION_ADDRESS.toLowerCase()) {
          const parsed = fusionIface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed) {
            console.log(`\n  🔶 ${parsed.name} (Fusion合约)`);
            if (parsed.name === 'FusionCommitted') {
              console.log(`     User: ${parsed.args.user}`);
              console.log(`     Parent A: ${parsed.args.parentA}`);
              console.log(`     Parent B: ${parsed.args.parentB}`);
              console.log(`     Commit Hash: ${parsed.args.commitHash}`);
            } else if (parsed.name === 'FusionRevealed') {
              console.log(`     User: ${parsed.args.user}`);
              console.log(`     Parent A: ${parsed.args.parentA}`);
              console.log(`     Parent B: ${parsed.args.parentB}`);
              console.log(`     New Token ID: ${parsed.args.newTokenId}`);
              console.log(`     Mode: ${parsed.args.mode === 0 ? 'BURN_TO_MINT' : 'SEAL'}`);
            }
          }
        }
      } catch (e) {
        // 无法解析的事件
      }
    }

    // 检查涉及的 Token
    const tokenIds = new Set<string>();
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === AGENT_ADDRESS.toLowerCase()) {
        try {
          const parsed = agentIface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === 'Transfer') {
            tokenIds.add(parsed.args.tokenId.toString());
          }
        } catch {}
      }
    }

    if (tokenIds.size > 0) {
      console.log('\n\n📊 涉及的 Token 当前状态:');
      console.log('-'.repeat(70));

      const agentContract = new ethers.Contract(AGENT_ADDRESS, AGENT_ABI, provider);

      for (const tokenId of tokenIds) {
        try {
          const lineage = await agentContract.getLineage(tokenId);
          const owner = await agentContract.ownerOf(tokenId);

          console.log(`\n  Token #${tokenId}:`);
          console.log(`     Owner: ${owner}`);
          console.log(`     House ID: ${Number(lineage.houseId)}`);
          console.log(`     Generation: ${Number(lineage.generation)}`);
          console.log(`     Parent 1: ${lineage.parent1.toString()}`);
          console.log(`     Parent 2: ${lineage.parent2.toString()}`);
          console.log(`     Sealed: ${lineage.sealed}`);
        } catch (e: any) {
          if (e.message?.includes('ERC721')) {
            console.log(`\n  Token #${tokenId}: ❌ 已销毁或不存在`);
          } else {
            console.log(`\n  Token #${tokenId}: 无法获取信息`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ 分析完成');
    console.log('='.repeat(70) + '\n');

  } catch (error: any) {
    console.error('❌ 错误:', error.message);
  }
}

main();
