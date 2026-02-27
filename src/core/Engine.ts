// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/core/Engine.ts — Central engine orchestrator

import * as PIXI from 'pixi.js';
import { GameLoop } from './GameLoop';
import { PhysicsSystem } from './PhysicsSystem';
import { StateManager } from './StateManager';
import { ECSWorld } from '@ecs/World';
import { RenderPipeline } from '@render/RenderPipeline';
import { AudioManager } from '@audio/AudioManager';
import { ModdingAPI } from '@modding/ModdingAPI';
import { EventBus } from './EventBus';

export interface EngineConfig {
  canvas: HTMLCanvasElement;
  targetFPS?: number;
  logicTickRate?: number;
  resolution?: { width: number; height: number };
  pixelScale?: 'auto' | 'nearest' | 'linear' | number;
  debug?: boolean;
}

export class OpenTalonsEngine {
  public readonly config: Required<EngineConfig>;
  public readonly events: EventBus;
  public readonly ecs: ECSWorld;
  public readonly physics: PhysicsSystem;
  public readonly renderer: RenderPipeline;
  public readonly audio: AudioManager;
  public readonly state: StateManager;
  public readonly modding: ModdingAPI;
  private loop!: GameLoop;
  private app!: PIXI.Application;

  constructor(config: EngineConfig) {
    this.config = {
      targetFPS: 144,
      logicTickRate: 60,
      resolution: { width: 1920, height: 1080 },
      pixelScale: 'auto',
      debug: false,
      ...config,
    };

    this.events = new EventBus();
    this.ecs = new ECSWorld();
    this.physics = new PhysicsSystem(this.ecs, this.events);
    this.audio = new AudioManager();
    this.state = new StateManager(this.events);
    this.modding = new ModdingAPI(this);

    // Renderer last — it depends on the ecs world being initialized
    this.renderer = new RenderPipeline(this.config, this.ecs);
  }

  async init(): Promise<void> {
    // Boot PixiJS
    this.app = new PIXI.Application();
    await this.app.init({
      canvas: this.config.canvas,
      width: this.config.resolution.width,
      height: this.config.resolution.height,
      backgroundColor: 0x000000,
      antialias: false,          // Pixel-art fidelity: no AA
      resolution: this.resolvePixelScale(),
      autoDensity: true,
    });

    PIXI.TextureStyle.defaultOptions.scaleMode = 'nearest'; // Sharp pixel-art upscaling

    await this.renderer.init(this.app);
    await this.audio.init();
    this.physics.init();
    this.state.init();

    // Wire up the fixed-timestep game loop
    this.loop = new GameLoop({
      targetFPS: this.config.targetFPS,
      logicTickRate: this.config.logicTickRate,
      onLogicTick: (dt: number) => this.logicTick(dt),
      onRenderFrame: (alpha: number) => this.renderFrame(alpha),
    });

    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    if (this.config.debug) {
      this.enableDebugOverlay();
    }

    console.log(
      `%c🦅 OpenTalons Engine v0.1.0 — Ready`,
      'color:#F5A623;font-weight:bold;font-size:14px'
    );
  }

  start(): void {
    this.loop.start();
    this.events.emit('engine:started', {});
  }

  stop(): void {
    this.loop.stop();
    this.events.emit('engine:stopped', {});
  }

  private logicTick(dt: number): void {
    this.state.update(dt);
    this.physics.update(dt);
    this.ecs.update(dt);
    this.modding.runScripts(dt);
  }

  private renderFrame(alpha: number): void {
    this.renderer.render(alpha);
  }

  private resolvePixelScale(): number {
    if (typeof this.config.pixelScale === 'number') return this.config.pixelScale;
    if (this.config.pixelScale === 'auto') return window.devicePixelRatio || 1;
    return 1;
  }

  private handleResize(): void {
    const { width, height } = this.config.resolution;
    const scaleX = window.innerWidth / width;
    const scaleY = window.innerHeight / height;
    const scale = Math.min(scaleX, scaleY);
    const canvas = this.config.canvas;
    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${height * scale}px`;
    canvas.style.position = 'absolute';
    canvas.style.left = `${(window.innerWidth - width * scale) / 2}px`;
    canvas.style.top = `${(window.innerHeight - height * scale) / 2}px`;
  }

  private enableDebugOverlay(): void {
    // Expose engine globally for browser devtools debugging
    (window as unknown as Record<string, unknown>).__opentalons__ = this;
  }
}
