import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@repo/config': path.resolve(__dirname, '../../packages/config/src'),
            '@repo/db': path.resolve(__dirname, '../../packages/db/src'),
            '@repo/logger': path.resolve(__dirname, '../../packages/logger/src'),
            '@repo/schemas': path.resolve(__dirname, '../../packages/schemas/src'),
            '@repo/types': path.resolve(__dirname, '../../packages/types/src'),
            '@repo/utils': path.resolve(__dirname, '../../packages/utils/src'),
            '@repo/tailwind-config': path.resolve(__dirname, '../../packages/tailwind-config/src'),
            '@repo/biome-config': path.resolve(__dirname, '../../packages/biome-config/src')
        }
    }
});
