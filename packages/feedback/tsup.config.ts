import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/schemas/index.ts', 'src/schemas/server.ts', 'src/config/index.ts'],
    format: ['esm'],
    dts: process.env.SKIP_PACKAGE_DTS !== 'true',
    clean: true,
    sourcemap: true,
    external: ['react'],
    // CSS files (tokens.css and the colocated component styles) are bundled
    // into a single dist/index.css file emitted alongside the JS, rather than
    // injected as <style> tags at hydration time. `injectStyle: true` was
    // tried and reverted: Astro's ClientRouter replaces the <head> on every
    // soft navigation, and the injected tags were dropped with it.
    //
    // Consumers must therefore attach '@repo/feedback/styles.css' themselves.
    // A static import at the app entry point is the simplest way and is what
    // apps/admin does. It is NOT the only way, and apps/web deliberately does
    // something else (HOS-369 W3-5): a static import makes the sheet
    // render-blocking on every page, which measured 4,105 B wire / 18,611 B
    // decoded on the critical path for a widget that hydrates `client:idle`.
    // apps/web imports it with Vite's `?url` suffix and attaches the <link>
    // at runtime, re-attaching on `astro:after-swap` to survive the same head
    // swap described above — see
    // `apps/web/src/components/feedback/load-feedback-styles.ts`.
    //
    // What every consumer MUST preserve, whichever way it attaches the sheet:
    // the package CSS has to land BEFORE any app-level override sheet, which
    // wins on load order rather than specificity.
    injectStyle: false
});
