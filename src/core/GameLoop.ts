// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/core/GameLoop.ts — Fixed-timestep game loop with decoupled render interpolation.
//
// Architecture:
//   Logic ticks run at a fixed rate (default 60 Hz, matching original Captain Claw).
//   Rendering runs as fast as the display allows (144Hz+).
//   Alpha interpolation allows smooth rendering between logic frames.

export interface GameLoopConfig {
  targetFPS: number;
  logicTickRate: number;
  onLogicTick: (dt: number) => void;
  onRenderFrame: (alpha: number) => void;
}

export class GameLoop {
  private readonly logicInterval: number; // ms per logic tick
  private readonly config: GameLoopConfig;
  private rafHandle: number | null = null;
  private previousTime: number = 0;
  private accumulator: number = 0;
  private running: boolean = false;

  // Performance telemetry
  private frameCount: number = 0;
  private lastFPSTime: number = 0;
  public currentFPS: number = 0;
  public logicTicksThisSecond: number = 0;
  private _logicTickCounter: number = 0;

  /** Maximum accumulation to prevent "spiral of death" on slow devices */
  private static readonly MAX_ACCUMULATOR_MS = 200;

  constructor(config: GameLoopConfig) {
    this.config = config;
    this.logicInterval = 1000 / config.logicTickRate;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.previousTime = performance.now();
    this.rafHandle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private tick = (currentTime: number): void => {
    if (!this.running) return;

    // ---- Timing ------------------------------------------------------------
    let frameTime = currentTime - this.previousTime;
    this.previousTime = currentTime;

    // Clamp to prevent spiral of death (e.g. when tab loses focus)
    if (frameTime > GameLoop.MAX_ACCUMULATOR_MS) {
      frameTime = GameLoop.MAX_ACCUMULATOR_MS;
    }

    this.accumulator += frameTime;

    // ---- Logic ticks (fixed timestep) -------------------------------------
    while (this.accumulator >= this.logicInterval) {
      this.config.onLogicTick(this.logicInterval / 1000); // pass dt in seconds
      this.accumulator -= this.logicInterval;
      this._logicTickCounter++;
    }

    // ---- Render frame (interpolated) --------------------------------------
    // Alpha ∈ [0, 1]: how far between the last and next logic tick we are
    const alpha = this.accumulator / this.logicInterval;
    this.config.onRenderFrame(alpha);

    // ---- FPS counter -------------------------------------------------------
    this.frameCount++;
    if (currentTime - this.lastFPSTime >= 1000) {
      this.currentFPS = this.frameCount;
      this.logicTicksThisSecond = this._logicTickCounter;
      this.frameCount = 0;
      this._logicTickCounter = 0;
      this.lastFPSTime = currentTime;
    }

    this.rafHandle = requestAnimationFrame(this.tick);
  };
}
