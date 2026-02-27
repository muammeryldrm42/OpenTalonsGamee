// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/main.ts — Engine bootstrap and entry point

import { OpenTalonsEngine } from '@core/Engine';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

const engine = new OpenTalonsEngine({
  canvas,
  targetFPS: 144,
  logicTickRate: 60,       // Match original Captain Claw tick rate for game-logic fidelity
  resolution: { width: 1920, height: 1080 },
  pixelScale: 'auto',      // Scales pixel-art assets to native resolution intelligently
  debug: import.meta.env.DEV,
});

await engine.init();
engine.start();
