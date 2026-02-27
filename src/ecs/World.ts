// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/ecs/World.ts — Entity-Component-System world wrapper around bitECS

import {
  createWorld,
  addEntity,
  removeEntity,
  addComponent,
  removeComponent,
  defineQuery,
  enterQuery,
  exitQuery,
  IWorld,
  ComponentType,
} from 'bitecs';

export type ECSEntity = number;
export type ECSComponent = ComponentType<Record<string, Float32Array | Int32Array | Uint8Array>>;

export class ECSWorld {
  public readonly world: IWorld;
  private readonly systems: Array<(world: IWorld, dt: number) => void> = [];

  constructor() {
    this.world = createWorld();
  }

  // ── Entity management ─────────────────────────────────────────────────────

  createEntity(): ECSEntity {
    return addEntity(this.world);
  }

  destroyEntity(eid: ECSEntity): void {
    removeEntity(this.world, eid);
  }

  // ── Component management ──────────────────────────────────────────────────

  add(eid: ECSEntity, ...components: ECSComponent[]): void {
    for (const comp of components) addComponent(this.world, comp, eid);
  }

  remove(eid: ECSEntity, ...components: ECSComponent[]): void {
    for (const comp of components) removeComponent(this.world, comp, eid);
  }

  // ── Querying ──────────────────────────────────────────────────────────────

  query(components: ECSComponent[]): readonly ECSEntity[] {
    return defineQuery(components)(this.world) as unknown as readonly ECSEntity[];
  }

  onEnter(components: ECSComponent[]) {
    return enterQuery(defineQuery(components));
  }

  onExit(components: ECSComponent[]) {
    return exitQuery(defineQuery(components));
  }

  // ── System registration ───────────────────────────────────────────────────

  registerSystem(system: (world: IWorld, dt: number) => void): void {
    this.systems.push(system);
  }

  update(dt: number): void {
    for (const system of this.systems) {
      system(this.world, dt);
    }
  }
}
