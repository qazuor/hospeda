import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/schemas/index.ts', 'src/schemas/server.ts', 'src/config/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['react'],
    // CSS files (tokens.css and the colocated component styles) are bundled
    // into a single dist/index.css file emitted alongside the JS. Consumers
    // must import '@repo/feedback/styles.css' at the entry point of their
    // app — exposing it as a static stylesheet so the host bundler (Vite,
    // Astro, etc.) tracks it as a normal CSS asset. This survives Astro
    // view transitions; the previous `injectStyle: true` approach injected
    // <style> tags at hydration time and they were dropped when Astro
    // replaced the <head> on navigation.
    injectStyle: false
});
