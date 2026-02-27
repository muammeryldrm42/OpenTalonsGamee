// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/ecs/components/TransformComponents.ts — Position and rotation SoA components

import { defineComponent, Types } from 'bitecs';

export const TransformComponents = {
  Position: defineComponent({ x: Types.f32, y: Types.f32 }),
  PreviousPosition: defineComponent({ x: Types.f32, y: Types.f32 }), // for render interpolation
  Rotation: defineComponent({ angle: Types.f32 }),
  Scale: defineComponent({ x: Types.f32, y: Types.f32 }),
};
