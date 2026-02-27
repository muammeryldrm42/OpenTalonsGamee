// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/core/PhysicsSystem.ts — Pixel-perfect physics emulation matching Captain Claw (1997).
//
// Original game constants (reverse-engineered):
//   Gravity:       0.35 px/tick²  (applied at 60 Hz)
//   Max fall speed: 16 px/tick
//   Jump impulse:  -9.5 px/tick
//   Walk speed:    3.0 px/tick
//   Ladder speed:  2.5 px/tick

import type { ECSWorld } from '@ecs/World';
import type { EventBus } from './EventBus';
import { PhysicsComponents } from '@ecs/components/PhysicsComponents';
import { TransformComponents } from '@ecs/components/TransformComponents';
import { CollisionComponents } from '@ecs/components/CollisionComponents';
import type { TileCollisionMap } from './TileCollisionMap';

// ── Physics Constants (original game values) ─────────────────────────────────
export const PHYSICS_CONSTANTS = {
  GRAVITY: 0.35,           // px per tick²
  MAX_FALL_SPEED: 16,      // px per tick (terminal velocity)
  JUMP_IMPULSE: -9.5,      // px per tick (upward = negative)
  WALK_SPEED: 3.0,         // px per tick
  LADDER_SPEED: 2.5,       // px per tick (vertical)
  TILE_SIZE: 64,           // px (original tile dimensions)
  PIXEL_STUCK_THRESHOLD: 2, // px — nudge amount for stuck-pixel avoidance
} as const;

export type CollisionFlags = 0 | 1; // 0 = passable, 1 = solid

export class PhysicsSystem {
  private collisionMap: TileCollisionMap | null = null;
  private readonly ecs: ECSWorld;
  private readonly events: EventBus;

  constructor(ecs: ECSWorld, events: EventBus) {
    this.ecs = ecs;
    this.events = events;
  }

  init(): void {
    // Systems are registered; collision map loaded separately when level loads
    this.events.on('level:loaded', (payload) => {
      const p = payload as { collisionMap: TileCollisionMap };
      this.collisionMap = p.collisionMap;
    });
  }

  /** Called once per logic tick at fixed 60 Hz */
  update(dt: number): void {
    if (!this.collisionMap) return;

    const { Position, PreviousPosition } = TransformComponents;
    const { VelocityX, VelocityY, OnGround, OnLadder } = PhysicsComponents;
    const { Width, Height } = CollisionComponents;

    const entities = this.ecs.query([
      Position, VelocityX, VelocityY, Width, Height,
    ]);

    for (const eid of entities) {
      // ── Apply gravity (skip if on ladder) ────────────────────────────────
      if (!OnLadder[eid]) {
        VelocityY[eid] += PHYSICS_CONSTANTS.GRAVITY;
        if (VelocityY[eid] > PHYSICS_CONSTANTS.MAX_FALL_SPEED) {
          VelocityY[eid] = PHYSICS_CONSTANTS.MAX_FALL_SPEED;
        }
      }

      // ── Save previous position for interpolated rendering ─────────────
      PreviousPosition.x[eid] = Position.x[eid];
      PreviousPosition.y[eid] = Position.y[eid];

      // ── Integrate velocity ────────────────────────────────────────────
      const newX = Position.x[eid] + VelocityX[eid];
      const newY = Position.y[eid] + VelocityY[eid];

      // ── Horizontal collision ─────────────────────────────────────────
      const resolvedX = this.resolveAxisCollision(
        newX, Position.y[eid],
        VelocityX[eid], 0,
        Width[eid], Height[eid],
        'horizontal'
      );
      Position.x[eid] = resolvedX.pos;
      if (resolvedX.blocked) VelocityX[eid] = 0;

      // ── Vertical collision ────────────────────────────────────────────
      const resolvedY = this.resolveAxisCollision(
        Position.x[eid], newY,
        0, VelocityY[eid],
        Width[eid], Height[eid],
        'vertical'
      );
      Position.y[eid] = resolvedY.pos;

      if (resolvedY.blocked) {
        const wasGrounded = !!OnGround[eid];
        if (VelocityY[eid] > 0) {
          // Landing
          OnGround[eid] = 1;
          if (!wasGrounded) {
            this.events.emit('entity:landed', { eid, velocity: VelocityY[eid] });
          }
        }
        VelocityY[eid] = 0;
      } else {
        OnGround[eid] = 0;
      }
    }
  }

  // ── Pixel-stuck avoidance ─────────────────────────────────────────────────
  // Nudges the entity slightly when it would otherwise be embedded inside
  // a tile boundary by less than PIXEL_STUCK_THRESHOLD pixels.
  private resolveAxisCollision(
    x: number, y: number,
    vx: number, vy: number,
    w: number, h: number,
    axis: 'horizontal' | 'vertical'
  ): { pos: number; blocked: boolean } {
    if (!this.collisionMap) return { pos: axis === 'horizontal' ? x : y, blocked: false };

    const half_w = w / 2;
    const half_h = h / 2;

    if (axis === 'horizontal') {
      // Test leading edge in movement direction
      const testX = vx > 0 ? x + half_w : x - half_w;
      const topY    = y - half_h + 1;
      const bottomY = y + half_h - 1;

      if (
        this.collisionMap.isSolid(testX, topY) ||
        this.collisionMap.isSolid(testX, bottomY)
      ) {
        // Snap back to tile boundary
        const tileX = Math.floor(testX / PHYSICS_CONSTANTS.TILE_SIZE);
        const snapped = vx > 0
          ? tileX * PHYSICS_CONSTANTS.TILE_SIZE - half_w - 1
          : (tileX + 1) * PHYSICS_CONSTANTS.TILE_SIZE + half_w + 1;

        // Pixel-stuck nudge: if snapped position is almost identical, push one pixel
        if (Math.abs(snapped - x) < PHYSICS_CONSTANTS.PIXEL_STUCK_THRESHOLD) {
          return { pos: x - Math.sign(vx), blocked: true };
        }
        return { pos: snapped, blocked: true };
      }
      return { pos: x, blocked: false };
    } else {
      // Vertical axis
      const testY  = vy > 0 ? y + half_h : y - half_h;
      const leftX  = x - half_w + 1;
      const rightX = x + half_w - 1;

      if (
        this.collisionMap.isSolid(leftX, testY) ||
        this.collisionMap.isSolid(rightX, testY)
      ) {
        const tileY = Math.floor(testY / PHYSICS_CONSTANTS.TILE_SIZE);
        const snapped = vy > 0
          ? tileY * PHYSICS_CONSTANTS.TILE_SIZE - half_h
          : (tileY + 1) * PHYSICS_CONSTANTS.TILE_SIZE + half_h;
        return { pos: snapped, blocked: true };
      }
      return { pos: y, blocked: false };
    }
  }
}
