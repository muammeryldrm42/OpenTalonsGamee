// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/parsers/WwdLoader.ts — Parser for Captain Claw .WWD level format.
//
// ── WWD Format Reference ─────────────────────────────────────────────────────
// Each .WWD file describes a single level (World) containing:
//   - Level metadata (name, author, tileset path, music)
//   - Up to 8 tile layers (tilemaps)
//   - A flat list of game objects (enemies, items, triggers, etc.)
//
// Header is 1536 bytes at offset 0.
// Objects are 360 bytes each.

import { TileCollisionMap } from '@core/TileCollisionMap';

// ── Constants ────────────────────────────────────────────────────────────────
const WWD_MAGIC = 0x574F524C;         // "WORL" in ASCII LE
const WWD_VERSION = 0x00050002;
const HEADER_SIZE = 1536;
const OBJECT_ENTRY_SIZE = 360;
const MAX_LAYERS = 8;
const LAYER_HEADER_SIZE = 52;

// ── Public Types ─────────────────────────────────────────────────────────────

export interface WwdObject {
  id: number;
  name: string;
  logic: string;       // Logic type string, e.g. "Claw", "Soldier", "Coin"
  imageSet: string;    // Sprite imageset path, e.g. "/GAME/IMAGES/CLAW"
  animation: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  speed: number;
  points: number;
  health: number;
  damage: number;
  smarts: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  moveRect: { minX: number; maxX: number; minY: number; maxY: number };
  userValue1: number;
  userValue2: number;
  userValue3: number;
  userValue4: number;
  userValue5: number;
  userValue6: number;
  userValue7: number;
  userValue8: number;
  addFlags: number;
  dynamicFlags: number;
  drawFlags: number;
  userFlags: number;
  type: number;
  typeFlags: number;
}

export interface WwdLayer {
  name: string;
  flags: number;
  fillTileId: number;
  tilesWide: number;
  tilesHigh: number;
  tileWidth: number;
  tileHeight: number;
  moveXPercent: number; // Parallax multiplier (100 = 1:1)
  moveYPercent: number;
  tiles: Int32Array;    // tile index, -1 = empty
}

export interface WwdLevel {
  version: number;
  flags: number;
  name: string;
  author: string;
  birth: string;
  rezFile: string;      // Path to companion .REZ (usually empty, uses global)
  imageDir: string;
  palRez: string;
  startX: number;
  startY: number;
  launchApp: string;
  imageSet1: string;
  imageSet2: string;
  imageSet3: string;
  imageSet4: string;
  prefix1: string;
  prefix2: string;
  prefix3: string;
  prefix4: string;
  layers: WwdLayer[];
  objects: WwdObject[];
  /** Derived collision map from the main tile layer (layer index 1 by convention) */
  collisionMap: TileCollisionMap;
}

// ── Parser ────────────────────────────────────────────────────────────────────

export class WwdLoader {

  static parse(buffer: ArrayBuffer): WwdLevel {
    const view = new DataView(buffer);
    const raw  = new Uint8Array(buffer);

    // ---- Header validation --------------------------------------------------
    const magic = view.getUint32(0x00, false);
    if (magic !== WWD_MAGIC) {
      // Some WWD files use a slightly different signature; try little-endian
      const magicStr = String.fromCharCode(raw[0], raw[1], raw[2], raw[3]);
      if (magicStr !== 'WORL' && magicStr !== 'LEVL') {
        throw new Error(`[WwdLoader] Invalid magic: "${magicStr}", expected "WORL"`);
      }
    }

    const version  = view.getUint32(0x04, true);
    const flags    = view.getUint32(0x08, true);

    // String fields in header (all 64-byte null-terminated strings from 0x10)
    const readStr = (offset: number, len = 64) =>
      WwdLoader.readString(raw, offset, len);

    const name       = readStr(0x10, 64);
    const author     = readStr(0x50, 64);
    const birth      = readStr(0x90, 64);
    const rezFile    = readStr(0xD0, 256);
    const imageDir   = readStr(0x1D0, 128);
    const palRez     = readStr(0x250, 128);
    const startX     = view.getInt32(0x2D0, true);
    const startY     = view.getInt32(0x2D4, true);
    const launchApp  = readStr(0x2D8, 128);
    const imageSet1  = readStr(0x358, 128);
    const imageSet2  = readStr(0x3D8, 128);
    const imageSet3  = readStr(0x458, 128);
    const imageSet4  = readStr(0x4D8, 128);
    const prefix1    = readStr(0x558, 32);
    const prefix2    = readStr(0x578, 32);
    const prefix3    = readStr(0x598, 32);
    const prefix4    = readStr(0x5B8, 32);

    const layerCount = view.getUint32(0x5D8, true);   // usually 8
    const numObjects = view.getUint32(0x5DC, true);
    const layerOffset   = view.getUint32(0x5E0, true); // offset to layer header table
    const objectsOffset = view.getUint32(0x5E4, true); // offset to objects list

    // ---- Parse layers -------------------------------------------------------
    const layers: WwdLayer[] = [];
    for (let i = 0; i < Math.min(layerCount, MAX_LAYERS); i++) {
      const layerBase = layerOffset + i * LAYER_HEADER_SIZE;
      layers.push(WwdLoader.parseLayerHeader(view, raw, buffer, layerBase));
    }

    // ---- Parse objects -------------------------------------------------------
    const objects: WwdObject[] = [];
    for (let i = 0; i < numObjects; i++) {
      const objBase = objectsOffset + i * OBJECT_ENTRY_SIZE;
      if (objBase + OBJECT_ENTRY_SIZE > buffer.byteLength) break;
      objects.push(WwdLoader.parseObject(view, raw, objBase));
    }

    // ---- Build collision map from action layer (layer 1 by convention) ------
    const actionLayer = layers[1] ?? layers[0];
    const collisionMap = WwdLoader.buildCollisionMap(actionLayer);

    return {
      version, flags, name, author, birth, rezFile, imageDir, palRez,
      startX, startY, launchApp,
      imageSet1, imageSet2, imageSet3, imageSet4,
      prefix1, prefix2, prefix3, prefix4,
      layers, objects, collisionMap,
    };
  }

  // ── Layer header parse ───────────────────────────────────────────────────

  private static parseLayerHeader(
    view: DataView,
    raw: Uint8Array,
    buffer: ArrayBuffer,
    base: number
  ): WwdLayer {
    const flags        = view.getUint32(base + 0x00, true);
    const name         = WwdLoader.readString(raw, base + 0x04, 32);
    const fillTileId   = view.getInt32 (base + 0x24, true);
    const tilesWide    = view.getInt32 (base + 0x28, true);
    const tilesHigh    = view.getInt32 (base + 0x2C, true);
    const tileWidth    = view.getInt32 (base + 0x30, true);
    const tileHeight   = view.getInt32 (base + 0x34, true);
    const moveXPercent = view.getInt32 (base + 0x38, true);
    const moveYPercent = view.getInt32 (base + 0x3C, true);
    const tilesOffset  = view.getUint32(base + 0x40, true);

    // Read tile data: tilesWide × tilesHigh Int32 values
    const tileCount = tilesWide * tilesHigh;
    const tiles = new Int32Array(buffer, tilesOffset, tileCount);

    return {
      name, flags, fillTileId, tilesWide, tilesHigh,
      tileWidth, tileHeight, moveXPercent, moveYPercent,
      tiles: new Int32Array(tiles), // copy to detach from shared buffer
    };
  }

  // ── Object parse ─────────────────────────────────────────────────────────

  private static parseObject(
    view: DataView,
    raw: Uint8Array,
    base: number
  ): WwdObject {
    const rs = (off: number, len: number) => WwdLoader.readString(raw, base + off, len);

    return {
      id:          view.getInt32 (base + 0x00, true),
      name:        rs(0x04, 32),
      logic:       rs(0x24, 32),
      imageSet:    rs(0x44, 128),
      animation:   rs(0xC4, 32),
      x:           view.getInt32 (base + 0xE4, true),
      y:           view.getInt32 (base + 0xE8, true),
      z:           view.getInt32 (base + 0xEC, true),
      width:       view.getInt32 (base + 0xF0, true),
      height:      view.getInt32 (base + 0xF4, true),
      speed:       view.getInt32 (base + 0xF8, true),
      points:      view.getInt32 (base + 0xFC, true),
      health:      view.getInt32 (base + 0x100, true),
      damage:      view.getInt32 (base + 0x104, true),
      smarts:      view.getInt32 (base + 0x108, true),
      minX:        view.getInt32 (base + 0x10C, true),
      maxX:        view.getInt32 (base + 0x110, true),
      minY:        view.getInt32 (base + 0x114, true),
      maxY:        view.getInt32 (base + 0x118, true),
      moveRect: {
        minX:      view.getInt32 (base + 0x11C, true),
        maxX:      view.getInt32 (base + 0x120, true),
        minY:      view.getInt32 (base + 0x124, true),
        maxY:      view.getInt32 (base + 0x128, true),
      },
      userValue1:  view.getInt32 (base + 0x12C, true),
      userValue2:  view.getInt32 (base + 0x130, true),
      userValue3:  view.getInt32 (base + 0x134, true),
      userValue4:  view.getInt32 (base + 0x138, true),
      userValue5:  view.getInt32 (base + 0x13C, true),
      userValue6:  view.getInt32 (base + 0x140, true),
      userValue7:  view.getInt32 (base + 0x144, true),
      userValue8:  view.getInt32 (base + 0x148, true),
      addFlags:    view.getUint32(base + 0x14C, true),
      dynamicFlags:view.getUint32(base + 0x150, true),
      drawFlags:   view.getUint32(base + 0x154, true),
      userFlags:   view.getUint32(base + 0x158, true),
      type:        view.getInt32 (base + 0x15C, true),
      typeFlags:   view.getUint32(base + 0x160, true),
    };
  }

  // ── Collision map construction ────────────────────────────────────────────
  // Tile IDs with the high bit set (0x8000) indicate solid tiles in WWD.

  private static buildCollisionMap(layer: WwdLayer): TileCollisionMap {
    const map = new TileCollisionMap(
      layer.tilesWide, layer.tilesHigh, layer.tileWidth
    );
    for (let row = 0; row < layer.tilesHigh; row++) {
      for (let col = 0; col < layer.tilesWide; col++) {
        const idx = row * layer.tilesWide + col;
        const tileId = layer.tiles[idx];
        if (tileId < 0) continue; // -1 = empty cell
        // High nibble indicates collision type in WWD
        const solid = (tileId & 0x80000000) !== 0 || tileId === 0; // solid or empty-void
        map.set(col, row, solid ? 1 : 0);
      }
    }
    return map;
  }

  // ── Helper: null-terminated ASCII string ─────────────────────────────────

  private static readString(raw: Uint8Array, offset: number, maxLen: number): string {
    let end = offset;
    const limit = Math.min(offset + maxLen, raw.length);
    while (end < limit && raw[end] !== 0) end++;
    return String.fromCharCode(...raw.slice(offset, end));
  }
}
