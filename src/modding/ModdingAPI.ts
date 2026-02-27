// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/modding/ModdingAPI.ts — JavaScript/TypeScript scripting interface for community mods.
//
// Mods are plain JS/TS modules that export an object conforming to the `Mod` interface.
// The engine sandbox provides controlled access to engine systems without exposing internals.

import type { OpenTalonsEngine } from '@core/Engine';
import type { ECSEntity } from '@ecs/World';

// ── Mod Contract ──────────────────────────────────────────────────────────────

export interface Mod {
  /** Unique identifier: "author.modName" convention */
  id: string;
  name: string;
  version: string;
  /** Called once when the mod is loaded */
  onLoad?(api: ModAPI): void | Promise<void>;
  /** Called each logic tick */
  onTick?(dt: number, api: ModAPI): void;
  /** Called when mod is unloaded / game exits */
  onUnload?(api: ModAPI): void;
}

// ── Sandboxed Engine API exposed to mods ──────────────────────────────────────

export interface ModAPI {
  /** Create a new entity and return its ID */
  createEntity(): ECSEntity;
  /** Destroy an entity */
  destroyEntity(eid: ECSEntity): void;
  /** Subscribe to engine events */
  on(event: string, handler: (payload: unknown) => void): () => void;
  /** Emit custom events (namespaced under "mod:") */
  emit(event: string, payload: unknown): void;
  /** Play a registered sound */
  playSound(alias: string, options?: { loop?: boolean; volume?: number }): void;
  /** Log to console (prefixed with mod ID) */
  log(...args: unknown[]): void;
}

// ── Modding API Manager ────────────────────────────────────────────────────────

export class ModdingAPI {
  private readonly mods = new Map<string, Mod>();
  private readonly engine: OpenTalonsEngine;

  constructor(engine: OpenTalonsEngine) {
    this.engine = engine;
  }

  async loadMod(mod: Mod): Promise<void> {
    if (this.mods.has(mod.id)) {
      console.warn(`[ModdingAPI] Mod "${mod.id}" is already loaded.`);
      return;
    }
    this.mods.set(mod.id, mod);
    const api = this.createAPI(mod.id);
    await mod.onLoad?.(api);
    console.log(`[ModdingAPI] ✅ Loaded mod: ${mod.name} (${mod.version})`);
  }

  async unloadMod(id: string): Promise<void> {
    const mod = this.mods.get(id);
    if (!mod) return;
    mod.onUnload?.(this.createAPI(id));
    this.mods.delete(id);
  }

  runScripts(dt: number): void {
    for (const [id, mod] of this.mods) {
      if (mod.onTick) {
        try {
          mod.onTick(dt, this.createAPI(id));
        } catch (err) {
          console.error(`[ModdingAPI] Error in mod "${id}" onTick:`, err);
        }
      }
    }
  }

  private createAPI(modId: string): ModAPI {
    const engine = this.engine;
    return {
      createEntity:  () => engine.ecs.createEntity(),
      destroyEntity: (eid) => engine.ecs.destroyEntity(eid),
      on:            (event, handler) => engine.events.on(event, handler as () => void),
      emit:          (event, payload) => engine.events.emit(`mod:${event}`, payload),
      playSound:     (alias, opts) => engine.audio.play(alias, opts),
      log:           (...args) => console.log(`[Mod:${modId}]`, ...args),
    };
  }
}
