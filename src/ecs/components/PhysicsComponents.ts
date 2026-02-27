// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/ecs/components/PhysicsComponents.ts

import { defineComponent, Types } from 'bitecs';

export const PhysicsComponents = {
  VelocityX: defineComponent({ value: Types.f32 }),
  VelocityY: defineComponent({ value: Types.f32 }),
  OnGround:  defineComponent({ value: Types.ui8 }),  // 0 or 1
  OnLadder:  defineComponent({ value: Types.ui8 }),  // 0 or 1
  Gravity:   defineComponent({ scale: Types.f32 }),  // per-entity gravity multiplier (default 1.0)
};

// Re-export a flattened API for use in PhysicsSystem (the ECS stores SoA arrays)
// PhysicsSystem accesses e.g. VelocityX[eid] which maps to VelocityX.value[eid]
// We proxy this with a Proxy for ergonomics.
function flatProxy<T extends { value: Float32Array | Uint8Array }>(comp: T) {
  return new Proxy(comp.value, {
    get(target, prop) { return Reflect.get(target, prop); },
    set(target, prop, val) { return Reflect.set(target, prop, val); },
  }) as unknown as Record<number, number>;
}

// These are the ergonomic aliases used in PhysicsSystem
export const VelocityX = flatProxy(PhysicsComponents.VelocityX);
export const VelocityY = flatProxy(PhysicsComponents.VelocityY);
export const OnGround  = flatProxy(PhysicsComponents.OnGround);
export const OnLadder  = flatProxy(PhysicsComponents.OnLadder);
