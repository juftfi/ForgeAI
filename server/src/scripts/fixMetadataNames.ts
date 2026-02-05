/**
 * 修复元数据文件中的名称字段
 * 确保名称与实际 House 属性匹配
 *
 * 用法: npx tsx src/scripts/fixMetadataNames.ts
 */

import fs from 'fs';
import path from 'path';

const METADATA_DIR = path.resolve(__dirname, '../../../assets/metadata');

// House 名称的各种变体形式
const HOUSE_VARIANTS: Record<string, string[]> = {
  CLEAR: ['Clear', 'CLEAR', 'clear'],
  MONSOON: ['Monsoon', 'MONSOON', 'monsoon'],
  THUNDER: ['Thunder', 'THUNDER', 'thunder'],
  FROST: ['Frost', 'FROST', 'frost'],
  AURORA: ['Aurora', 'AURORA', 'aurora'],
  SAND: ['Sand', 'SAND', 'sand'],
  ECLIPSE: ['Eclipse', 'ECLIPSE', 'eclipse'],
};

// 获取 House 的标题格式 (首字母大写)
function toTitleCase(house: string): string {
  return house.charAt(0).toUpperCase() + house.slice(1).toLowerCase();
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🔧 修复元数据名称字段');
  console.log('='.repeat(60) + '\n');

  const files = fs.readdirSync(METADATA_DIR)
    .filter(f => f.endsWith('.json') && f !== 'collection.json');

  let fixed = 0;
  let skipped = 0;

  for (const file of files) {
    const tokenId = parseInt(file.replace('.json', ''), 10);
    if (isNaN(tokenId)) continue;

    const filepath = path.join(METADATA_DIR, file);
    const content = fs.readFileSync(filepath, 'utf8');
    const metadata = JSON.parse(content);

    // 获取当前 House 属性
    const houseAttr = metadata.attributes?.find(
      (a: { trait_type: string }) => a.trait_type === 'House'
    );

    if (!houseAttr) {
      console.log(`  #${tokenId}: 跳过 - 没有House属性`);
      skipped++;
      continue;
    }

    const currentHouse = houseAttr.value;
    const expectedHouseTitle = toTitleCase(currentHouse);
    let modified = false;

    // 检查并修复名称
    if (metadata.name) {
      // 检查名称中是否包含错误的 house 名称
      for (const [house, variants] of Object.entries(HOUSE_VARIANTS)) {
        if (house === currentHouse) continue; // 跳过正确的 house

        for (const variant of variants) {
          // 匹配 "House Xxx" 或 "— House Xxx" 格式
          const patterns = [
            new RegExp(`House ${variant}`, 'g'),
            new RegExp(`— House ${variant}`, 'g'),
            new RegExp(`- House ${variant}`, 'g'),
          ];

          for (const pattern of patterns) {
            if (pattern.test(metadata.name)) {
              const replacement = metadata.name.includes('— House')
                ? `— House ${expectedHouseTitle}`
                : metadata.name.includes('- House')
                ? `- House ${expectedHouseTitle}`
                : `House ${expectedHouseTitle}`;

              metadata.name = metadata.name.replace(pattern, replacement);
              modified = true;
            }
          }
        }
      }
    }

    if (modified) {
      fs.writeFileSync(filepath, JSON.stringify(metadata, null, 2));
      console.log(`  ✏️  #${tokenId}: 名称已修复 → House ${expectedHouseTitle}`);
      fixed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📈 结果: 修复 ${fixed} 个, 跳过 ${skipped} 个`);
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
