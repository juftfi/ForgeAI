#!/usr/bin/env tsx
/**
 * Build Render Job Queue
 *
 * Creates a JSONL job queue from render recipes for batch processing.
 *
 * Usage:
 *   pnpm render:jobs
 */

import fs from 'fs';
import path from 'path';

interface RenderRecipe {
  version: number;
  tokenId: number;
  houseKey: string;
  templateBlend: string;
  output: {
    path: string;
  };
}

interface RenderJob {
  id: string;
  tokenId: number;
  recipePath: string;
  templatePath: string;
  outputPath: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  attempts: number;
  createdAt: string;
}

function parseArgs(): { recipesDir: string; jobsDir: string; overwrite: boolean } {
  const args = process.argv.slice(2);
  let recipesDir = path.resolve(__dirname, '../../../render/recipes');
  let jobsDir = path.resolve(__dirname, '../../../render/jobs');
  let overwrite = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--recipes' || arg === '-r') {
      recipesDir = args[++i];
    } else if (arg === '--jobs' || arg === '-j') {
      jobsDir = args[++i];
    } else if (arg === '--overwrite' || arg === '-f') {
      overwrite = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Build Render Job Queue

Usage:
  pnpm render:jobs [options]

Options:
  --recipes, -r <dir>  Recipes directory (default: render/recipes)
  --jobs, -j <dir>     Jobs output directory (default: render/jobs)
  --overwrite, -f      Overwrite existing jobs file
  --help, -h           Show this help
      `);
      process.exit(0);
    }
  }

  return { recipesDir, jobsDir, overwrite };
}

function loadRecipe(recipePath: string): RenderRecipe | null {
  try {
    const content = fs.readFileSync(recipePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const { recipesDir, jobsDir, overwrite } = parseArgs();

  console.log('📋 HouseForge Render Job Queue Builder');
  console.log('======================================\n');

  // Ensure jobs directory exists
  fs.mkdirSync(jobsDir, { recursive: true });

  const jobsFile = path.join(jobsDir, 'jobs.jsonl');

  // Check for existing jobs file
  if (fs.existsSync(jobsFile) && !overwrite) {
    console.log(`⚠️ Jobs file already exists: ${jobsFile}`);
    console.log('   Use --overwrite to replace it.');
    process.exit(1);
  }

  // Find all recipe files
  if (!fs.existsSync(recipesDir)) {
    console.error('❌ Recipes directory not found:', recipesDir);
    console.log('   Run `pnpm render:recipes` first.');
    process.exit(1);
  }

  const recipeFiles = fs.readdirSync(recipesDir)
    .filter(f => f.endsWith('.json'))
    .map(f => parseInt(f.replace('.json', ''), 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);

  if (recipeFiles.length === 0) {
    console.error('❌ No recipe files found in:', recipesDir);
    process.exit(1);
  }

  console.log(`📁 Found ${recipeFiles.length} recipes`);
  console.log(`📂 Output: ${jobsFile}\n`);

  // Build jobs
  const jobs: RenderJob[] = [];
  const now = new Date().toISOString();

  for (const tokenId of recipeFiles) {
    const recipePath = path.join(recipesDir, `${tokenId}.json`);
    const recipe = loadRecipe(recipePath);

    if (!recipe) {
      console.log(`  ⚠️ Token #${tokenId} - Failed to load recipe, skipping`);
      continue;
    }

    const job: RenderJob = {
      id: `job_${tokenId}_${Date.now()}`,
      tokenId,
      recipePath: `render/recipes/${tokenId}.json`,
      templatePath: recipe.templateBlend,
      outputPath: recipe.output.path,
      status: 'pending',
      attempts: 0,
      createdAt: now,
    };

    jobs.push(job);
  }

  // Write jobs file (JSONL format - one job per line)
  const jobsContent = jobs.map(job => JSON.stringify(job)).join('\n');
  fs.writeFileSync(jobsFile, jobsContent, 'utf-8');

  // Write status file
  const statusFile = path.join(jobsDir, 'status.json');
  const status = {
    totalJobs: jobs.length,
    pending: jobs.length,
    running: 0,
    completed: 0,
    failed: 0,
    createdAt: now,
    updatedAt: now,
  };
  fs.writeFileSync(statusFile, JSON.stringify(status, null, 2), 'utf-8');

  console.log('======================================');
  console.log(`✅ Job queue built successfully!`);
  console.log(`   Total jobs: ${jobs.length}`);
  console.log(`   Jobs file: ${jobsFile}`);
  console.log(`   Status file: ${statusFile}`);
}

main().catch((err) => {
  console.error('Job queue building failed:', err);
  process.exit(1);
});
