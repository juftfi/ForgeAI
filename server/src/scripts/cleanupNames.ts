/**
 * 清理元数据中的重复破折号
 */

import fs from 'fs';
import path from 'path';

const METADATA_DIR = path.resolve(__dirname, '../../../assets/metadata');

const files = fs.readdirSync(METADATA_DIR)
  .filter(f => f.endsWith('.json') && f !== 'collection.json');

let fixed = 0;
for (const file of files) {
  const filepath = path.join(METADATA_DIR, file);
  let content = fs.readFileSync(filepath, 'utf8');
  if (content.includes('— —') || content.includes('- -')) {
    content = content.replace(/— —/g, '—').replace(/- -/g, '-');
    fs.writeFileSync(filepath, content);
    fixed++;
  }
}
console.log(`Fixed ${fixed} files`);
