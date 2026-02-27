#!/usr/bin/env tsx
// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// tools/asset-converter/cli.ts — Command-line tool for extracting/converting
//   Captain Claw asset archives (.REZ → individual files, .PID → PNG, etc.)
//
// Usage:
//   npm run tools:convert -- rez extract CLAW.REZ ./output
//   npm run tools:convert -- rez list CLAW.REZ
//   npm run tools:convert -- pid to-png sprite.PID ./output

import { Command } from 'commander';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';
import { RezLoader } from '../../src/parsers/RezLoader';
import { PidLoader } from '../../src/parsers/PidLoader';

const program = new Command();

program
  .name('opentalons-tools')
  .description('OpenTalons asset conversion utilities')
  .version('0.1.0');

// ── REZ commands ─────────────────────────────────────────────────────────────

const rez = program.command('rez').description('Work with .REZ archive files');

rez
  .command('list <rezFile>')
  .description('List all files inside a .REZ archive')
  .option('-d, --dir <path>', 'Filter by virtual directory path', '/')
  .action(async (rezFile: string, opts: { dir: string }) => {
    const buffer = readFileSync(rezFile).buffer as ArrayBuffer;
    const archive = await RezLoader.load(buffer);

    const entries = archive.listDir(opts.dir);
    console.log(`\n📦 ${basename(rezFile)} — ${archive.fileCount} total files\n`);
    console.log(`Listing: ${opts.dir}\n`);

    for (const entry of entries) {
      const kb = (entry.size / 1024).toFixed(1);
      console.log(`  ${entry.path.padEnd(60)} ${kb.padStart(8)} KB`);
    }

    console.log(`\n  ${entries.length} entries shown.\n`);
  });

rez
  .command('extract <rezFile> <outputDir>')
  .description('Extract all files from a .REZ archive to disk')
  .option('-d, --dir <path>', 'Only extract files under this virtual path', '/')
  .option('-e, --ext <ext>', 'Only extract files with this extension (e.g. WAV)')
  .action(async (rezFile: string, outputDir: string, opts: { dir: string; ext?: string }) => {
    const buffer = readFileSync(rezFile).buffer as ArrayBuffer;
    const archive = await RezLoader.load(buffer);

    const entries = archive.listDir(opts.dir).filter(e =>
      opts.ext ? e.extension === opts.ext.toUpperCase() : true
    );

    console.log(`\n📦 Extracting ${entries.length} files to ${outputDir}...\n`);
    let extracted = 0;

    for (const entry of entries) {
      const destPath = join(outputDir, entry.path);
      const destDir  = destPath.substring(0, destPath.lastIndexOf('/'));

      mkdirSync(destDir, { recursive: true });

      try {
        const data = archive.readFile(entry.path);
        writeFileSync(destPath, data);
        extracted++;
        process.stdout.write(`\r  Extracted: ${extracted}/${entries.length}`);
      } catch (e) {
        console.error(`\n  ⚠ Failed to extract ${entry.path}: ${(e as Error).message}`);
      }
    }

    console.log(`\n\n✅ Done! Extracted ${extracted} files to ${outputDir}\n`);
  });

rez
  .command('info <rezFile>')
  .description('Show archive metadata')
  .action(async (rezFile: string) => {
    const buffer = readFileSync(rezFile).buffer as ArrayBuffer;
    const archive = await RezLoader.load(buffer);

    console.log(`\n📦 REZ Archive: ${basename(rezFile)}`);
    console.log(`   Version:     ${archive.version}`);
    console.log(`   File count:  ${archive.fileCount}`);

    // Count by extension
    const all = archive.listDir('/');
    const extCounts: Record<string, number> = {};
    for (const f of all) {
      extCounts[f.extension] = (extCounts[f.extension] ?? 0) + 1;
    }
    console.log('\n   File types:');
    for (const [ext, count] of Object.entries(extCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`     .${ext.padEnd(6)} ${count} files`);
    }
    console.log();
  });

// ── PID commands ─────────────────────────────────────────────────────────────

const pid = program.command('pid').description('Convert .PID sprite frames');

pid
  .command('to-png <pidFile> <outputDir>')
  .description('Convert a .PID sprite frame to a PNG image')
  .option('-p, --palette <palFile>', 'Path to a 768-byte raw palette file')
  .action(async (pidFile: string, outputDir: string, opts: { palette?: string }) => {
    console.log(`\n🖼  Converting ${basename(pidFile)}...`);

    const buffer   = readFileSync(pidFile).buffer as ArrayBuffer;
    let palette: Uint8Array | undefined;
    if (opts.palette) {
      palette = new Uint8Array(readFileSync(opts.palette));
    }

    const loader = new PidLoader(palette);
    const frame  = loader.parse(buffer);

    // Write raw RGBA as a minimal PNG using the Canvas API (Node doesn't have it, but
    // in a real CLI build you'd pull in 'canvas' npm package or use 'sharp').
    // For now, we output a raw RGBA file that can be imported by image tools.
    const outName = basename(pidFile, extname(pidFile)) + '.rgba';
    const outPath = join(outputDir, outName);
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(outPath, frame.pixels);

    console.log(
      `✅ Written ${outPath} (${frame.width}×${frame.height} px, pivot: ${frame.offsetX},${frame.offsetY})\n`
    );
    console.log('   Note: Output is raw RGBA. Convert to PNG with:');
    console.log(`   ffmpeg -f rawvideo -pix_fmt rgba -s ${frame.width}x${frame.height} -i ${outName} out.png\n`);
  });

program.parse(process.argv);
