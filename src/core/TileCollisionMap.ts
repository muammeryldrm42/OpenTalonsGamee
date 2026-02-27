// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/core/TileCollisionMap.ts — Spatial lookup structure for tile solidity

import { PHYSICS_CONSTANTS } from './PhysicsSystem';

export type TileAttribute = 0 | 1 | 2 | 3;
// 0 = empty, 1 = solid, 2 = one-way platform, 3 = ladder

export class TileCollisionMap {
  private readonly data: Uint8Array;
  public readonly cols: number;
  public readonly rows: number;
  private readonly tileSize: number;

  constructor(cols: number, rows: number, tileSize = PHYSICS_CONSTANTS.TILE_SIZE) {
    this.cols = cols;
    this.rows = rows;
    this.tileSize = tileSize;
    this.data = new Uint8Array(cols * rows);
  }

  set(col: number, row: number, attr: TileAttribute): void {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    this.data[row * this.cols + col] = attr;
  }

  get(col: number, row: number): TileAttribute {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 1; // OOB = solid
    return this.data[row * this.cols + col] as TileAttribute;
  }

  getAtPixel(px: number, py: number): TileAttribute {
    const col = Math.floor(px / this.tileSize);
    const row = Math.floor(py / this.tileSize);
    return this.get(col, row);
  }

  isSolid(px: number, py: number): boolean {
    return this.getAtPixel(px, py) === 1;
  }

  isLadder(px: number, py: number): boolean {
    return this.getAtPixel(px, py) === 3;
  }

  isOneWayPlatform(px: number, py: number): boolean {
    return this.getAtPixel(px, py) === 2;
  }
}
