// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/core/StateManager.ts — Push-down automaton state machine for game scenes

import type { EventBus } from './EventBus';

export interface GameState {
  readonly name: string;
  onEnter(prev?: GameState): void | Promise<void>;
  onExit(next?: GameState): void | Promise<void>;
  update(dt: number): void;
}

export class StateManager {
  private readonly stack: GameState[] = [];
  private readonly events: EventBus;
  private transitioning = false;

  constructor(events: EventBus) {
    this.events = events;
  }

  init(): void { /* hook for future startup states */ }

  get current(): GameState | undefined {
    return this.stack[this.stack.length - 1];
  }

  async push(state: GameState): Promise<void> {
    if (this.transitioning) return;
    this.transitioning = true;
    const prev = this.current;
    this.stack.push(state);
    await state.onEnter(prev);
    this.events.emit('state:pushed', { state: state.name });
    this.transitioning = false;
  }

  async pop(): Promise<GameState | undefined> {
    if (this.transitioning || this.stack.length === 0) return undefined;
    this.transitioning = true;
    const popped = this.stack.pop()!;
    const next = this.current;
    await popped.onExit(next);
    this.events.emit('state:popped', { state: popped.name });
    this.transitioning = false;
    return popped;
  }

  async replace(state: GameState): Promise<void> {
    await this.pop();
    await this.push(state);
  }

  update(dt: number): void {
    this.current?.update(dt);
  }
}
