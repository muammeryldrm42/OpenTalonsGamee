// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/audio/AudioManager.ts — Audio system supporting WAV/OGG and legacy MIDI.

import { sound, Sound } from '@pixi/sound';

export interface SoundOptions {
  loop?: boolean;
  volume?: number;
  speed?: number;
}

export class AudioManager {
  private masterVolume = 1.0;
  private muted = false;

  async init(): Promise<void> {
    // @pixi/sound integrates with PixiJS asset system automatically
    sound.volumeAll = this.masterVolume;
  }

  /** Preload a sound from a URL or Uint8Array blob */
  async load(alias: string, src: string | Uint8Array): Promise<void> {
    if (sound.exists(alias)) return;

    if (src instanceof Uint8Array) {
      const blob = new Blob([src]);
      const url  = URL.createObjectURL(blob);
      await sound.add(alias, { url, preload: true });
    } else {
      await sound.add(alias, { url: src, preload: true });
    }
  }

  play(alias: string, options: SoundOptions = {}): void {
    if (this.muted || !sound.exists(alias)) return;
    sound.play(alias, {
      loop: options.loop ?? false,
      volume: (options.volume ?? 1) * this.masterVolume,
      speed: options.speed ?? 1,
    });
  }

  stop(alias: string): void {
    sound.stop(alias);
  }

  setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    sound.volumeAll = this.muted ? 0 : this.masterVolume;
  }

  mute(): void {
    this.muted = true;
    sound.volumeAll = 0;
  }

  unmute(): void {
    this.muted = false;
    sound.volumeAll = this.masterVolume;
  }
}
