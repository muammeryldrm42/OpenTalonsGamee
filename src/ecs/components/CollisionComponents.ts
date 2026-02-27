// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/ecs/components/CollisionComponents.ts

import { defineComponent, Types } from 'bitecs';

export const CollisionComponents = {
  Width:  defineComponent({ value: Types.f32 }),
  Height: defineComponent({ value: Types.f32 }),
  Layer:  defineComponent({ mask: Types.ui32 }), // Bitmask for collision filtering
};

// Ergonomic proxies
function flat<T extends { value: Float32Array | Uint32Array }>(c: T) {
  return c.value as unknown as Record<number, number>;
}

export const Width  = flat(CollisionComponents.Width);
export const Height = flat(CollisionComponents.Height);
