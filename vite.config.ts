// MIT License — Copyright (c) 2026 OpenTalons Contributors
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@render': path.resolve(__dirname, 'src/render'),
      '@parsers': path.resolve(__dirname, 'src/parsers'),
      '@audio': path.resolve(__dirname, 'src/audio'),
      '@ecs': path.resolve(__dirname, 'src/ecs'),
      '@modding': path.resolve(__dirname, 'src/modding'),
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
          ecs: ['bitecs'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
