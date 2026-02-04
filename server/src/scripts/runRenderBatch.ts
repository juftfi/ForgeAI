#!/usr/bin/env tsx
/**
 * Run Render Batch
 *
 * Executes Blender renders from the job queue with retry support.
 *
 * Usage:
 *   pnpm render:batch -- --start 1 --count 20
 *   pnpm render:batch -- --all
 *
 * Prerequisites:
 *   - Blender must be installed and available in PATH
 *   - Scene templates must be generated: blender -b -P render/scripts/generate_templates.py -- --output-dir render/scenes
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

interface RenderJob {
  id: string;
  tokenId: number;
  recipePath: string;
  templatePath: string;
  outputPath: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  attempts: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

interface JobStatus {
  totalJobs: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  createdAt: string;
  updatedAt: string;
}

const MAX_RETRIES = 2;
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

function parseArgs(): {
  start: number;
  count: number;
  all: boolean;
  jobsDir: string;
  blenderPath: string;
  concurrency: number;
  dryRun: boolean;
} {
  const args = process.argv.slice(2);
  let start = 1;
  let count = 20;
  let all = false;
  let jobsDir = path.join(PROJECT_ROOT, 'render/jobs');
  let blenderPath = process.env.BLENDER_PATH || 'D:/New Folder/blender.exe';
  let concurrency = 1;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--start' || arg === '-s') {
      start = parseInt(args[++i], 10);
    } else if (arg === '--count' || arg === '-c') {
      count = parseInt(args[++i], 10);
    } else if (arg === '--all' || arg === '-a') {
      all = true;
    } else if (arg === '--jobs' || arg === '-j') {
      jobsDir = args[++i];
    } else if (arg === '--blender' || arg === '-b') {
      blenderPath = args[++i];
    } else if (arg === '--concurrency' || arg === '-n') {
      concurrency = parseInt(args[++i], 10);
    } else if (arg === '--dry-run' || arg === '-d') {
      dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Run Render Batch

Usage:
  pnpm render:batch [options]

Options:
  --start, -s <n>       Start from token ID (default: 1)
  --count, -c <n>       Number of renders (default: 20)
  --all, -a             Render all pending jobs
  --jobs, -j <dir>      Jobs directory (default: render/jobs)
  --blender, -b <path>  Blender executable path (default: blender)
  --concurrency, -n <n> Parallel renders (default: 1)
  --dry-run, -d         Show what would be rendered without executing
  --help, -h            Show this help

Prerequisites:
  1. Generate scene templates first:
     blender -b -P render/scripts/generate_templates.py -- --output-dir render/scenes

  2. Generate render recipes:
     pnpm render:recipes

  3. Build job queue:
     pnpm render:jobs
      `);
      process.exit(0);
    }
  }

  return { start, count, all, jobsDir, blenderPath, concurrency, dryRun };
}

function checkBlenderInstalled(blenderPath: string): boolean {
  try {
    execSync(`"${blenderPath}" --version`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function loadJobs(jobsDir: string): RenderJob[] {
  const jobsFile = path.join(jobsDir, 'jobs.jsonl');
  if (!fs.existsSync(jobsFile)) {
    return [];
  }

  const content = fs.readFileSync(jobsFile, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

function saveJobs(jobs: RenderJob[], jobsDir: string): void {
  const jobsFile = path.join(jobsDir, 'jobs.jsonl');
  const content = jobs.map(job => JSON.stringify(job)).join('\n');
  fs.writeFileSync(jobsFile, content, 'utf-8');
}

function updateStatus(jobs: RenderJob[], jobsDir: string): void {
  const statusFile = path.join(jobsDir, 'status.json');
  const status: JobStatus = {
    totalJobs: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    running: jobs.filter(j => j.status === 'running').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    createdAt: jobs[0]?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(statusFile, JSON.stringify(status, null, 2), 'utf-8');
}

function checkTemplatesExist(): boolean {
  const scenesDir = path.join(PROJECT_ROOT, 'render/scenes');
  if (!fs.existsSync(scenesDir)) {
    return false;
  }

  const requiredTemplates = [
    'house_clear.blend',
    'house_monsoon.blend',
    'house_thunder.blend',
    'house_frost.blend',
    'house_aurora.blend',
    'house_sand.blend',
    'house_eclipse.blend',
  ];

  for (const template of requiredTemplates) {
    if (!fs.existsSync(path.join(scenesDir, template))) {
      return false;
    }
  }

  return true;
}

async function renderJob(
  job: RenderJob,
  blenderPath: string,
  projectRoot: string
): Promise<{ success: boolean; error?: string }> {
  const templatePath = path.join(projectRoot, job.templatePath);
  const recipePath = path.join(projectRoot, job.recipePath);
  const outputPath = path.join(projectRoot, job.outputPath);
  const renderScript = path.join(projectRoot, 'render/scripts/render_token.py');

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  return new Promise((resolve) => {
    const blenderArgs = [
      '-b', templatePath,
      '-P', renderScript,
      '--',
      recipePath,
      outputPath,
    ];

    console.log(`    Command: ${blenderPath} ${blenderArgs.join(' ')}`);

    const proc = spawn(blenderPath, blenderArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve({ success: true });
      } else {
        resolve({
          success: false,
          error: stderr || stdout || `Exit code: ${code}`,
        });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

async function main(): Promise<void> {
  const { start, count, all, jobsDir, blenderPath, concurrency, dryRun } = parseArgs();

  console.log('🎬 HouseForge Render Batch Runner');
  console.log('==================================\n');

  // Check Blender
  if (!dryRun && !checkBlenderInstalled(blenderPath)) {
    console.error('❌ Blender not found!');
    console.log(`   Make sure Blender is installed and '${blenderPath}' is in your PATH.`);
    console.log('   Or specify the path: --blender /path/to/blender');
    process.exit(1);
  }

  // Check templates
  if (!dryRun && !checkTemplatesExist()) {
    console.error('❌ Scene templates not found!');
    console.log('   Generate them first with:');
    console.log('   blender -b -P render/scripts/generate_templates.py -- --output-dir render/scenes');
    process.exit(1);
  }

  // Load jobs
  const allJobs = loadJobs(jobsDir);
  if (allJobs.length === 0) {
    console.error('❌ No jobs found!');
    console.log('   Build the job queue first with: pnpm render:jobs');
    process.exit(1);
  }

  // Filter jobs to process
  let jobsToProcess: RenderJob[];
  if (all) {
    jobsToProcess = allJobs.filter(j => j.status === 'pending' || j.status === 'failed');
  } else {
    jobsToProcess = allJobs
      .filter(j => j.tokenId >= start && (j.status === 'pending' || j.status === 'failed'))
      .slice(0, count);
  }

  if (jobsToProcess.length === 0) {
    console.log('✅ No pending jobs to process.');
    return;
  }

  console.log(`📋 Jobs: ${allJobs.length} total, ${jobsToProcess.length} to process`);
  console.log(`🖥️  Blender: ${blenderPath}`);
  console.log(`⚙️  Concurrency: ${concurrency}`);

  if (dryRun) {
    console.log('\n🔍 DRY RUN - Would render:\n');
    for (const job of jobsToProcess) {
      console.log(`  Token #${job.tokenId}: ${job.templatePath} → ${job.outputPath}`);
    }
    return;
  }

  console.log('\n🚀 Starting renders...\n');

  let completed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const job of jobsToProcess) {
    const jobIndex = allJobs.findIndex(j => j.id === job.id);
    if (jobIndex === -1) continue;

    console.log(`📸 Rendering token #${job.tokenId} (attempt ${job.attempts + 1}/${MAX_RETRIES + 1})...`);

    // Update job status
    allJobs[jobIndex].status = 'running';
    allJobs[jobIndex].attempts++;
    saveJobs(allJobs, jobsDir);
    updateStatus(allJobs, jobsDir);

    // Render
    const result = await renderJob(job, blenderPath, PROJECT_ROOT);

    if (result.success) {
      allJobs[jobIndex].status = 'completed';
      allJobs[jobIndex].completedAt = new Date().toISOString();
      completed++;
      console.log(`  ✅ Token #${job.tokenId} completed`);
    } else {
      if (allJobs[jobIndex].attempts >= MAX_RETRIES + 1) {
        allJobs[jobIndex].status = 'failed';
        allJobs[jobIndex].error = result.error;
        failed++;
        console.log(`  ❌ Token #${job.tokenId} failed: ${result.error?.substring(0, 100)}`);
      } else {
        allJobs[jobIndex].status = 'pending'; // Will retry
        console.log(`  ⚠️ Token #${job.tokenId} failed, will retry`);
      }
    }

    // Save after each job
    saveJobs(allJobs, jobsDir);
    updateStatus(allJobs, jobsDir);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n==================================');
  console.log('📊 Batch complete!');
  console.log(`   Completed: ${completed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Time: ${elapsed}s`);

  if (completed > 0) {
    const avgTime = (parseFloat(elapsed) / completed).toFixed(1);
    console.log(`   Avg time: ${avgTime}s per render`);
  }

  // Show final status
  const finalPending = allJobs.filter(j => j.status === 'pending').length;
  const finalCompleted = allJobs.filter(j => j.status === 'completed').length;
  const finalFailed = allJobs.filter(j => j.status === 'failed').length;

  console.log(`\n📈 Overall progress: ${finalCompleted}/${allJobs.length} completed`);
  if (finalFailed > 0) {
    console.log(`   ⚠️ ${finalFailed} jobs failed`);
  }
  if (finalPending > 0) {
    console.log(`   📋 ${finalPending} jobs still pending`);
  }
}

main().catch((err) => {
  console.error('Batch render failed:', err);
  process.exit(1);
});
