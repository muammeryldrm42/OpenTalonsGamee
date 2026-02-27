// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/core/EventBus.ts — Typed publish/subscribe event system

type EventPayloadMap = Record<string, unknown>;
type Handler<T> = (payload: T) => void;

export class EventBus {
  private readonly listeners = new Map<string, Set<Handler<unknown>>>();

  on<K extends string>(event: K, handler: Handler<EventPayloadMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const handlers = this.listeners.get(event)!;
    handlers.add(handler as Handler<unknown>);
    // Return an unsubscribe function
    return () => handlers.delete(handler as Handler<unknown>);
  }

  once<K extends string>(event: K, handler: Handler<EventPayloadMap[K]>): void {
    const unsub = this.on(event, (payload) => {
      handler(payload);
      unsub();
    });
  }

  emit<K extends string>(event: K, payload: EventPayloadMap[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(payload);
    }
  }

  off(event: string): void {
    this.listeners.delete(event);
  }

  clear(): void {
    this.listeners.clear();
  }
}
