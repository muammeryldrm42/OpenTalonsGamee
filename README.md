# 🦅 OpenTalons

> A high-performance, open-source 2D game engine — a modern web-first reimplementation of the classic *Captain Claw* (1997) engine, built for 2026 standards.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![PixiJS](https://img.shields.io/badge/PixiJS-8.0-red.svg)](https://pixijs.com/)
[![Node](https://img.shields.io/badge/Node-%3E%3D20-green.svg)](https://nodejs.org/)

---

## ✨ Vision

OpenTalons aims to be the definitive, open-source reimplementation of the RIOT engine that powered *Captain Claw* — playable in any modern web browser, exportable as a desktop app, and fully extensible by the community.

It is spiritually inspired by [OpenClaw](https://github.com/AntonioCS/OpenClaw) but built from the ground up on a modern 2026 web-native stack: TypeScript, PixiJS WebGL, and a strict Entity-Component System architecture.

---

## 🗂️ Project Architecture

```
OpenTalons/
├── src/
│   ├── core/              # Engine heart
│   │   ├── Engine.ts          ← Central orchestrator, boots all systems
│   │   ├── GameLoop.ts        ← Fixed-timestep logic / decoupled rendering
│   │   ├── PhysicsSystem.ts   ← Pixel-perfect tile collision (original constants)
│   │   ├── TileCollisionMap.ts← Spatial tile solidity lookup
│   │   ├── StateManager.ts    ← Push-down automaton scene/state machine
│   │   └── EventBus.ts        ← Typed pub/sub event system
│   │
│   ├── render/            # WebGL rendering pipeline
│   │   └── RenderPipeline.ts  ← PixiJS stage management, render interpolation
│   │
│   ├── parsers/           # Legacy asset decoders
│   │   ├── RezLoader.ts       ← .REZ archive extraction
│   │   ├── WwdLoader.ts       ← .WWD level map parser
│   │   └── PidLoader.ts       ← .PID sprite frame decoder (RLE + palette)
│   │
│   ├── audio/             # Sound engine
│   │   └── AudioManager.ts    ← WAV/OGG playback via @pixi/sound
│   │
│   ├── ecs/               # Entity-Component System
│   │   ├── World.ts           ← bitECS world wrapper
│   │   └── components/
│   │       ├── TransformComponents.ts
│   │       ├── PhysicsComponents.ts
│   │       └── CollisionComponents.ts
│   │
│   ├── modding/           # Community scripting API
│   │   └── ModdingAPI.ts      ← JS/TS mod interface & sandbox
│   │
│   └── main.ts            # Bootstrap entry point
│
├── tools/
│   └── asset-converter/
│       └── cli.ts         ← CLI: extract/convert original game assets
│
├── docs/                  # Architecture diagrams, format specs
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── LICENSE
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Browser / Tauri                     │
├─────────────────────────────────────────────────────────┤
│                     OpenTalons Engine                   │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │GameLoop  │→ │  ECS     │→ │Physics   │              │
│  │(144Hz+)  │  │ World    │  │System    │              │
│  │fixed dt  │  │(bitECS)  │  │(60Hz)    │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│        │                           │                    │
│        ↓                           ↓                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │Render    │  │ State    │  │ Modding  │              │
│  │Pipeline  │  │ Manager  │  │   API    │              │
│  │(PixiJS)  │  │(PDA FSM) │  │(sandbox) │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│        │                                                │
│  ┌─────┴──────┐  ┌────────────┐  ┌──────────────┐     │
│  │  Parsers   │  │   Audio    │  │   EventBus   │     │
│  │ REZ/WWD   │  │  Manager   │  │ (pub/sub)    │     │
│  │ PID/PAL   │  │(@pixi/snd) │  └──────────────┘     │
│  └────────────┘  └────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 20.0.0
- **npm** ≥ 10.0.0
- A legally-owned copy of *Captain Claw* (1997) for original game assets

### Installation

```bash
# Clone the repository
git clone https://github.com/opentalons/opentalons.git
cd opentalons

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open `http://localhost:3000` in your browser.

### Building for Production

```bash
npm run build
# Output in ./dist — deployable as a static web app
```

### Desktop App (Tauri)

```bash
# Install Tauri CLI
cargo install tauri-cli

# Run desktop build
npx tauri dev    # Development
npx tauri build  # Production binary
```

---

## 🗜️ Asset Extraction (CLI Tool)

Before playing, you need to extract the original game assets from your owned copy of Captain Claw.

```bash
# List all files in a .REZ archive
npm run tools:convert -- rez list /path/to/CLAW.REZ

# Extract all files to ./assets/original/
npm run tools:convert -- rez extract /path/to/CLAW.REZ ./assets/original

# Extract only sound files
npm run tools:convert -- rez extract /path/to/CLAW.REZ ./assets/sounds --ext WAV

# Show archive metadata
npm run tools:convert -- rez info /path/to/CLAW.REZ

# Convert a .PID sprite frame to raw RGBA
npm run tools:convert -- pid to-png sprite.PID ./output
```

---

## 🔧 Using the Parsers Programmatically

### REZ Archive

```typescript
import { RezLoader } from './src/parsers/RezLoader';

// Load from a browser File input
const file = document.getElementById('rez-input').files[0];
const archive = await RezLoader.load(file);

// Read a specific file
const bytes = archive.readFile('/SOUNDS/AMBIENT/RAIN.WAV');

// List all files in a directory
const sprites = archive.listDir('/GAME/IMAGES');

// Check existence
if (archive.exists('/STATES/CLAW/IMAGES/WALK1.PID')) {
  // ...
}
```

### WWD Level

```typescript
import { WwdLoader } from './src/parsers/WwdLoader';

const buffer = await someFile.arrayBuffer();
const level = WwdLoader.parse(buffer);

console.log(level.name);               // "The Docks"
console.log(level.layers[1].tilesWide); // e.g. 512
console.log(level.objects.length);     // number of game objects

// Built-in collision map — ready for PhysicsSystem
const isBlocked = level.collisionMap.isSolid(128, 256);
```

### PID Sprite

```typescript
import { PidLoader } from './src/parsers/PidLoader';

const loader = new PidLoader(palette768ByteBuffer);
const frame = loader.parse(pidBuffer);

// Use directly as a PixiJS texture
const texture = PidLoader.toTexture(frame);
const sprite  = new PIXI.Sprite(texture);
sprite.anchor.set(
  frame.offsetX / frame.width,
  frame.offsetY / frame.height
);
```

---

## 🎮 Physics Constants

OpenTalons faithfully replicates the original game's physics at 60 Hz:

| Constant | Value | Description |
|---|---|---|
| `GRAVITY` | `0.35 px/tick²` | Downward acceleration |
| `MAX_FALL_SPEED` | `16 px/tick` | Terminal velocity |
| `JUMP_IMPULSE` | `-9.5 px/tick` | Initial upward velocity on jump |
| `WALK_SPEED` | `3.0 px/tick` | Horizontal movement speed |
| `LADDER_SPEED` | `2.5 px/tick` | Vertical movement on ladder |
| `TILE_SIZE` | `64 px` | Native tile dimensions |

The game loop runs logic at a **fixed 60 Hz** regardless of display refresh rate. Rendering interpolates between logic frames for smooth motion on 144Hz+ monitors.

---

## 🧩 Writing a Mod

Mods are plain TypeScript modules. Place them anywhere and load them at runtime:

```typescript
import type { Mod, ModAPI } from './src/modding/ModdingAPI';

export const MyMod: Mod = {
  id: 'myname.my-mod',
  name: 'My Awesome Mod',
  version: '1.0.0',

  onLoad(api: ModAPI) {
    api.log('Hello from my mod!');
    api.on('entity:landed', (payload) => {
      api.playSound('landing_sfx', { volume: 0.5 });
    });
  },

  onTick(dt: number, api: ModAPI) {
    // Runs every logic tick (60 Hz)
  },

  onUnload(api: ModAPI) {
    api.log('Goodbye!');
  },
};
```

Load it in main.ts:

```typescript
await engine.modding.loadMod(MyMod);
```

---

## 🤝 Contributing

We welcome contributions from the retro-gaming and open-source communities!

### Quick Start for Contributors

```bash
# Fork & clone
git clone https://github.com/YOUR_USERNAME/opentalons.git

# Create a feature branch
git checkout -b feat/my-feature

# Run type checking
npm run typecheck

# Run tests
npm test

# Lint
npm run lint
```

### Contribution Guidelines

- **Every source file** must include the MIT license header comment.
- Follow the existing `src/core`, `src/render`, `src/parsers` module structure.
- Physics constants that affect gameplay **must** reference the original reverse-engineered values with a comment.
- Parser changes should include tests against known good sample data.
- Open a Discussion before starting large features (new parsers, rendering backends, etc.).

### Priority Areas

- [ ] Animation system (sprite sheet sequencing)
- [ ] Input system (keyboard/gamepad)
- [ ] MIDI playback (original music support)
- [ ] Level rendering (WWD tilemap → PixiJS TilingSprite)
- [ ] Enemy AI system (logic types from .WWD objects)
- [ ] Tauri integration for desktop packaging
- [ ] Sound atlas (batch-loading REZ sounds)

---

## 📜 Legal & Credits

**OpenTalons is not affiliated with Monolith Productions or Warner Bros.**

- *Captain Claw* (1997) is the property of **Monolith Productions / Warner Bros. Interactive Entertainment**.
- OpenTalons does **not** include any original game assets. You must own a legal copy of the game to use them.
- The reverse-engineered file format documentation is based on community research, primarily the [OpenClaw](https://github.com/AntonioCS/OpenClaw) project.

### Inspiration & Prior Art

- **[OpenClaw](https://github.com/AntonioCS/OpenClaw)** — The original open-source Captain Claw reimplementation in C++. A foundational reference for format specs and physics constants.
- **[bitECS](https://github.com/NateTheGreatt/bitECS)** — Blazing-fast ECS library for JavaScript.
- **[PixiJS](https://pixijs.com/)** — The WebGL 2D rendering engine powering OpenTalons.

---

## 📄 License

[MIT License](./LICENSE) — Copyright © 2026 OpenTalons Contributors.

---

*🦅 "The Docks await, Captain."*
