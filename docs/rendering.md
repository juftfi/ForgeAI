# HouseForge 3D Rendering Pipeline

This document explains how to generate the 2100 ultra-realistic 3D rendered images for the HouseForge NFT collection using Blender + Cycles.

## Overview

The rendering pipeline produces deterministic, trait-driven 3D renders with an Octane/Redshift-like aesthetic using Blender's Cycles renderer. Each token gets a unique **render recipe** that fully specifies how to recreate its image.

### Key Features

- **Deterministic**: Same recipe always produces same visual configuration
- **Trait-Driven**: Materials, lights, geometry automatically configured from token traits
- **Verifiable**: Recipe hashes stored on-chain for proof of generation
- **Reproducible**: Anyone can re-render using the recipe JSON

## Prerequisites

### 1. Install Blender

Download and install Blender 4.0+ from [blender.org](https://www.blender.org/download/).

**Important**: Ensure Blender is in your system PATH:

```bash
# Test Blender installation
blender --version
```

On Windows, you may need to add Blender to PATH manually:
```
C:\Program Files\Blender Foundation\Blender 4.0\
```

### 2. GPU Rendering (Recommended)

For faster renders, enable GPU computing in Blender:

1. Open Blender
2. Edit → Preferences → System
3. Under "Cycles Render Devices", select CUDA/OptiX (NVIDIA) or HIP (AMD)
4. Check your GPU(s)

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    HouseForge Render Pipeline                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Generate Templates    2. Generate Recipes    3. Build Jobs  │
│  ┌───────────────────┐   ┌───────────────────┐  ┌─────────────┐│
│  │ blender -b -P     │   │ pnpm render:      │  │ pnpm render:││
│  │ generate_templates│ → │ recipes           │→ │ jobs        ││
│  └───────────────────┘   └───────────────────┘  └─────────────┘│
│           │                       │                     │       │
│           ▼                       ▼                     ▼       │
│  ┌───────────────────┐   ┌───────────────────┐  ┌─────────────┐│
│  │ render/scenes/    │   │ render/recipes/   │  │ render/jobs/││
│  │ *.blend           │   │ *.json            │  │ jobs.jsonl  ││
│  └───────────────────┘   └───────────────────┘  └─────────────┘│
│                                                         │       │
│                                                         ▼       │
│  4. Batch Render             5. Update Metadata                 │
│  ┌───────────────────┐       ┌───────────────────┐              │
│  │ pnpm render:batch │   →   │ pnpm render:      │              │
│  │ or render:all     │       │ update-metadata   │              │
│  └───────────────────┘       └───────────────────┘              │
│           │                           │                         │
│           ▼                           ▼                         │
│  ┌───────────────────┐       ┌───────────────────┐              │
│  │ render/output/    │       │ assets/metadata/  │              │
│  │ *.webp            │       │ (updated URIs)    │              │
│  └───────────────────┘       └───────────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Step-by-Step Guide

### Step 1: Generate Scene Templates

Create the 7 house-specific Blender scene templates:

```bash
# Navigate to project root
cd HouseForge

# Generate all 7 templates
blender -b -P render/scripts/generate_templates.py -- --output-dir render/scenes

# Or generate a specific house
blender -b -P render/scripts/generate_templates.py -- --output-dir render/scenes --house THUNDER
```

This creates:
- `render/scenes/house_clear.blend`
- `render/scenes/house_monsoon.blend`
- `render/scenes/house_thunder.blend`
- `render/scenes/house_frost.blend`
- `render/scenes/house_aurora.blend`
- `render/scenes/house_sand.blend`
- `render/scenes/house_eclipse.blend`

### Step 2: Generate Token Metadata

If you haven't already, generate the genesis metadata:

```bash
cd server
pnpm gen:metadata
```

This creates 2100 JSON files in `assets/metadata/`.

### Step 3: Generate Render Recipes

Create deterministic render recipes for all tokens:

```bash
# Generate all 2100 recipes
pnpm render:recipes

# Or generate a subset
pnpm render:recipes -- --start 1 --count 100
```

Each recipe (`render/recipes/{tokenId}.json`) contains:

```json
{
  "version": 1,
  "tokenId": 1,
  "houseKey": "CLEAR",
  "houseId": 1,
  "seed": "0x...",
  "traits": {
    "House": "CLEAR",
    "FrameType": "BrushedSteel",
    "CoreMaterial": "ClearCrystal",
    "LightSignature": "Sunbeam",
    ...
  },
  "templateBlend": "render/scenes/house_clear.blend",
  "geometryPreset": "Sphere",
  "cameraPreset": "main",
  "lightSignature": "Sunbeam",
  "output": {
    "width": 1024,
    "height": 1024,
    "format": "WEBP",
    "quality": 90,
    "path": "render/output/1.webp"
  },
  "renderSettings": {
    "engine": "CYCLES",
    "samples": 96,
    "denoise": true,
    "adaptiveSampling": true,
    "maxBounces": 6,
    "transparentBackground": false
  },
  "recipeHash": "0x..."
}
```

### Step 4: Build Job Queue

Create the batch processing job queue:

```bash
pnpm render:jobs
```

This creates:
- `render/jobs/jobs.jsonl` - One job per line
- `render/jobs/status.json` - Overall progress tracking

### Step 5: Run Batch Renders

Execute the renders:

```bash
# Render 20 tokens (quick test)
pnpm render:batch -- --start 1 --count 20

# Render all pending jobs
pnpm render:all

# Dry run (see what would be rendered)
pnpm render:batch -- --dry-run
```

**Estimated Time** (at 96 samples, 1024x1024):
- GPU: ~30-60 seconds per image
- CPU: ~3-5 minutes per image
- Full 2100 set: 18-35 hours (GPU) or 100+ hours (CPU)

### Step 6: Update Metadata

After rendering, update metadata files with image URIs:

```bash
# Preview changes
pnpm render:update-metadata -- --dry-run

# Apply changes (local development)
pnpm render:update-metadata

# Apply with production URL
pnpm render:update-metadata -- --base-url https://api.houseforge.io
```

## Render Quality Presets

The pipeline supports multiple quality levels defined in `render/presets/render_settings.yaml`:

| Preset | Samples | Resolution | Use Case |
|--------|---------|------------|----------|
| preview | 32 | 512x512 | Quick testing |
| mvp | 96 | 1024x1024 | **Default** - Production |
| hero | 256 | 2048x2048 | Promotional/Mythic |
| promo | 512 | 4096x4096 | Print/High-res |

To use a different preset, modify the recipe generation or batch render script.

## Trait → Visual Mapping

### Frame Materials

| FrameType | Base Color | Metallic | Roughness |
|-----------|------------|----------|-----------|
| BrushedSteel | Gray | 1.0 | 0.35 |
| PolishedBrass | Gold | 1.0 | 0.15 |
| AntiqueBronze | Brown | 1.0 | 0.50 |
| WhiteGold | Off-white | 1.0 | 0.10 |
| BlackTitanium | Near-black | 1.0 | 0.25 |
| MirrorChrome | Pure white | 1.0 | 0.02 |

### Core Materials

| CoreMaterial | Type | Transmission | Effect |
|--------------|------|--------------|--------|
| ClearCrystal | Glass | 0.95 | Pure transparency |
| CloudGlass | Glass | 0.70 | Frosted |
| LiquidMercury | Metal | 0.00 | Liquid metal |
| MoltenAmber | Glass | 0.85 | Warm glow |
| FrozenPlasma | Emission | 0.30 | Blue glow |

### Light Signatures

| Signature | House Default | Effect |
|-----------|---------------|--------|
| Sunbeam | CLEAR | Warm directional |
| NeonRain | MONSOON | Cool vertical streaks |
| LightningFork | THUNDER | High contrast electric |
| PolarGlow | FROST | Aurora-like soft |
| AuroraRibbon | AURORA | Multi-color bands |
| GoldenHaze | SAND | Warm haze |
| EclipseHalo | ECLIPSE | Dark center, bright rim |

## API Endpoints

The server provides endpoints for rendered assets:

```
GET /images/{tokenId}.webp    - Rendered image
GET /recipes/{tokenId}.json   - Render recipe
GET /render/status            - Job queue status
GET /render/recipes           - List all recipes
```

## Upgrading to Octane/Redshift

The pipeline is designed for easy backend swap:

1. **Keep the recipe format** - All trait mappings remain the same
2. **Create new templates** - Replace .blend files with Octane/Redshift scenes
3. **Update render script** - Modify `render_token.py` for new renderer
4. **Re-render** - Same recipes, new backend

The key principle: **Recipes are renderer-agnostic specifications**.

## Troubleshooting

### "Blender not found"

Ensure Blender is in your PATH:
```bash
# Windows
set PATH=%PATH%;C:\Program Files\Blender Foundation\Blender 4.0

# Linux/Mac
export PATH=$PATH:/Applications/Blender.app/Contents/MacOS
```

### "Scene templates not found"

Generate templates first:
```bash
blender -b -P render/scripts/generate_templates.py -- --output-dir render/scenes
```

### "No metadata files found"

Generate genesis metadata:
```bash
cd server
pnpm gen:metadata
```

### Renders are too slow

1. Enable GPU rendering in Blender preferences
2. Reduce samples: Edit recipes to use 64 samples
3. Reduce resolution: Change to 512x512 for testing
4. Use adaptive sampling (enabled by default)

### Out of memory

1. Reduce tile size in render settings
2. Close other applications
3. Use CPU rendering if GPU VRAM is insufficient

## File Structure

```
render/
├── scenes/                  # Blender templates
│   ├── house_clear.blend
│   ├── house_monsoon.blend
│   ├── house_thunder.blend
│   ├── house_frost.blend
│   ├── house_aurora.blend
│   ├── house_sand.blend
│   └── house_eclipse.blend
├── presets/                 # Configuration files
│   ├── camera.yaml
│   ├── lights.yaml
│   ├── materials.yaml
│   ├── render_settings.yaml
│   └── houses.yaml
├── scripts/                 # Blender Python scripts
│   ├── generate_templates.py
│   └── render_token.py
├── recipes/                 # Generated recipes
│   ├── 1.json
│   ├── 2.json
│   └── ...
├── jobs/                    # Job queue
│   ├── jobs.jsonl
│   └── status.json
└── output/                  # Rendered images
    ├── 1.webp
    ├── 2.webp
    └── ...
```

## Performance Benchmarks

Tested on various hardware (96 samples, 1024x1024):

| Hardware | Time per Image | Full Set (2100) |
|----------|---------------|-----------------|
| RTX 4090 | ~15s | ~9 hours |
| RTX 3080 | ~30s | ~18 hours |
| RTX 2070 | ~60s | ~35 hours |
| M1 Mac (GPU) | ~45s | ~26 hours |
| Ryzen 9 (CPU) | ~180s | ~105 hours |

**Tip**: Run overnight for full collection renders.
