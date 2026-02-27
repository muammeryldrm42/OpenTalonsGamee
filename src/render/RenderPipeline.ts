// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/render/RenderPipeline.ts — WebGL rendering pipeline via PixiJS

import * as PIXI from 'pixi.js';
import type { EngineConfig } from '@core/Engine';
import type { ECSWorld } from '@ecs/World';
import { TransformComponents } from '@ecs/components/TransformComponents';

export class RenderPipeline {
  private app!: PIXI.Application;
  private layerContainers: PIXI.Container[] = [];
  private spriteMap = new Map<number, PIXI.Sprite>(); // eid → sprite

  constructor(
    private readonly config: Required<EngineConfig>,
    private readonly ecs: ECSWorld,
  ) {}

  async init(app: PIXI.Application): Promise<void> {
    this.app = app;

    // Create render layers (matches WWD layer order)
    for (let i = 0; i < 8; i++) {
      const container = new PIXI.Container();
      container.label = `layer-${i}`;
      this.app.stage.addChild(container);
      this.layerContainers.push(container);
    }
  }

  /**
   * Render one frame, with alpha interpolation for smooth motion between logic ticks.
   * @param alpha — [0, 1] progress between last and next logic tick
   */
  render(alpha: number): void {
    const { Position, PreviousPosition } = TransformComponents;

    for (const [eid, sprite] of this.spriteMap) {
      // Interpolate between previous and current position for smooth rendering
      // regardless of display refresh rate
      sprite.x = PreviousPosition.x[eid] + (Position.x[eid] - PreviousPosition.x[eid]) * alpha;
      sprite.y = PreviousPosition.y[eid] + (Position.y[eid] - PreviousPosition.y[eid]) * alpha;
    }

    // PixiJS renders automatically via its own ticker;
    // we drive it manually for decoupled loop control.
    this.app.renderer.render(this.app.stage);
  }

  registerSprite(eid: number, sprite: PIXI.Sprite, layer = 1): void {
    this.spriteMap.set(eid, sprite);
    this.layerContainers[layer]?.addChild(sprite);
  }

  unregisterSprite(eid: number): void {
    const sprite = this.spriteMap.get(eid);
    if (sprite) {
      sprite.parent?.removeChild(sprite);
      sprite.destroy();
      this.spriteMap.delete(eid);
    }
  }

  getLayerContainer(index: number): PIXI.Container | undefined {
    return this.layerContainers[index];
  }
}
