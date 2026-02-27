// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/parsers/PidLoader.ts — Parser for Captain Claw .PID sprite frame format.
//
// ── PID Format ───────────────────────────────────────────────────────────────
// A .PID file holds a single sprite frame (image) in a palettised format.
//
// Header (16 bytes):
//   0x00  4   Magic "PID\0" or little-endian 0x00444950
//   0x04  2   Width  (pixels)
//   0x06  2   Height (pixels)
//   0x08  2   Offset X (pivot / hot-spot)
//   0x0A  2   Offset Y (pivot / hot-spot)
//   0x0C  4   Flags
//             Bit 0: HasColorKey  (index 0 = transparent)
//             Bit 1: Compressed   (RLE compressed pixel data)
//             Bit 2: HasPalette   (file includes its own 256-color palette)
//
// If HasPalette is set, the next 768 bytes are the palette (256 × RGB).
// Pixel data follows immediately after the header (or palette).
//
// Compressed data uses simple Run-Length Encoding (RLE):
//   - Count byte 0x00..0x7F: repeat the following byte (count+1) times
//   - Count byte 0x80..0xFF: copy the following (count-0x80+1) bytes verbatim

import * as PIXI from 'pixi.js';

export interface PidFrame {
  width: number;
  height: number;
  offsetX: number;   // Pivot point (hot-spot) X
  offsetY: number;   // Pivot point (hot-spot) Y
  flags: number;
  /** Raw RGBA pixel data, row-major, 4 bytes per pixel */
  pixels: Uint8ClampedArray;
  /** PixiJS texture, created on first access */
  texture?: PIXI.Texture;
}

const PID_FLAG_COLOR_KEY  = 0x01;
const PID_FLAG_COMPRESSED = 0x02;
const PID_FLAG_HAS_PALETTE = 0x04;

// Default Captain Claw 256-color palette (placeholder — ship with assets in a real build)
const DEFAULT_PALETTE = new Uint8Array(768); // all black; replaced by level palette

export class PidLoader {

  private palette: Uint8Array;

  constructor(palette?: Uint8Array) {
    this.palette = palette ?? DEFAULT_PALETTE;
  }

  /** Set the active palette (loaded from the level's companion palette file) */
  setPalette(palette: Uint8Array): void {
    if (palette.length !== 768) {
      throw new Error(`[PidLoader] Palette must be 768 bytes (256×RGB), got ${palette.length}`);
    }
    this.palette = palette;
  }

  parse(buffer: ArrayBuffer): PidFrame {
    const view = new DataView(buffer);
    const raw  = new Uint8Array(buffer);

    // ---- Header -------------------------------------------------------------
    const magicStr = String.fromCharCode(raw[0], raw[1], raw[2]);
    if (magicStr !== 'PID') {
      throw new Error(`[PidLoader] Invalid PID magic: "${magicStr}"`);
    }

    const width   = view.getUint16(0x04, true);
    const height  = view.getUint16(0x06, true);
    const offsetX = view.getInt16 (0x08, true);
    const offsetY = view.getInt16 (0x0A, true);
    const flags   = view.getUint32(0x0C, true);

    const hasColorKey  = (flags & PID_FLAG_COLOR_KEY) !== 0;
    const isCompressed = (flags & PID_FLAG_COMPRESSED) !== 0;
    const hasPalette   = (flags & PID_FLAG_HAS_PALETTE) !== 0;

    let cursor = 0x10;

    // ---- Per-file palette (optional) ----------------------------------------
    let palette = this.palette;
    if (hasPalette) {
      palette = raw.slice(cursor, cursor + 768);
      cursor += 768;
    }

    // ---- Pixel data ---------------------------------------------------------
    const pixelCount = width * height;
    let indices: Uint8Array;

    if (isCompressed) {
      indices = PidLoader.decompressRLE(raw, cursor, pixelCount);
    } else {
      indices = raw.slice(cursor, cursor + pixelCount);
    }

    // ---- Palette → RGBA conversion ------------------------------------------
    const pixels = new Uint8ClampedArray(pixelCount * 4);
    for (let i = 0; i < pixelCount; i++) {
      const idx = indices[i];
      const pi  = idx * 3;
      const base = i * 4;

      if (hasColorKey && idx === 0) {
        // Transparent pixel
        pixels[base + 0] = 0;
        pixels[base + 1] = 0;
        pixels[base + 2] = 0;
        pixels[base + 3] = 0;
      } else {
        pixels[base + 0] = palette[pi + 0];
        pixels[base + 1] = palette[pi + 1];
        pixels[base + 2] = palette[pi + 2];
        pixels[base + 3] = 255;
      }
    }

    return { width, height, offsetX, offsetY, flags, pixels };
  }

  /** Convert a PidFrame to a PixiJS Texture */
  static toTexture(frame: PidFrame): PIXI.Texture {
    if (frame.texture) return frame.texture;

    const imageData = new ImageData(frame.pixels, frame.width, frame.height);
    const canvas = document.createElement('canvas');
    canvas.width  = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);

    const texture = PIXI.Texture.from(canvas);
    frame.texture = texture;
    return texture;
  }

  // ── RLE decompression ────────────────────────────────────────────────────

  private static decompressRLE(
    src: Uint8Array,
    srcOffset: number,
    expectedPixels: number
  ): Uint8Array {
    const out = new Uint8Array(expectedPixels);
    let srcPos = srcOffset;
    let dstPos = 0;

    while (dstPos < expectedPixels && srcPos < src.length) {
      const control = src[srcPos++];

      if (control <= 0x7F) {
        // Run of (control + 1) repeated bytes
        const count = control + 1;
        const value = src[srcPos++];
        for (let i = 0; i < count && dstPos < expectedPixels; i++) {
          out[dstPos++] = value;
        }
      } else {
        // Literal copy of (control - 0x80 + 1) bytes
        const count = control - 0x80 + 1;
        for (let i = 0; i < count && dstPos < expectedPixels && srcPos < src.length; i++) {
          out[dstPos++] = src[srcPos++];
        }
      }
    }

    if (dstPos !== expectedPixels) {
      console.warn(
        `[PidLoader] RLE decompression produced ${dstPos} pixels, expected ${expectedPixels}`
      );
    }

    return out;
  }
}
