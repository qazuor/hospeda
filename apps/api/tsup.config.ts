import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin';
import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    outDir: 'dist',
    target: 'es2022',
    format: ['esm'],
    splitting: false,
    sourcemap: true,
    clean: true,
    dts: true,
    bundle: true,
    tsconfig: './tsconfig.json',
    // Sentry source maps upload (build-time only).
    // Gated on SENTRY_AUTH_TOKEN so local builds without the token still
    // succeed — the plugin only registers when the token is present. Org
    // and project slugs are hardcoded; the auth token is org-scoped and
    // shared across hospeda-web/hospeda-admin/hospeda-api.
    esbuildPlugins: process.env.SENTRY_AUTH_TOKEN
        ? [
              sentryEsbuildPlugin({
                  org: 'qazuor',
                  project: 'hospeda-api',
                  authToken: process.env.SENTRY_AUTH_TOKEN
              })
          ]
        : undefined,
    // Externalised packages: bundling these breaks at runtime because
    // they either ship only as CommonJS (using dynamic require()), or
    // pull in CJS-only transitive deps (e.g. react-dom/server uses
    // require('util'), require('crypto')). esbuild emits a polyfill
    // (`__require`) that throws "Dynamic require of X is not supported"
    // when the polyfill cannot resolve to a real `require`. Keeping
    // them as runtime imports lets Node's normal CJS interop handle
    // the resolution. Each entry is a direct dependency of apps/api so
    // pnpm installs it at apps/api/node_modules where the deployed
    // function can find it.
    external: [
        '@sentry/profiling-node',
        'cloudinary',
        'file-type',
        'image-size',
        'react',
        'react-dom',
        'react-dom/server',
        '@react-email/components',
        '@react-email/render',
        'resend',
        'ioredis',
        'node-cron',
        // @vercel/oidc uses dynamic require("path")/require("fs") which esbuild's
        // polyfill cannot resolve at runtime in ESM. Externalize to let Node's
        // native CJS interop handle it. It's a transitive dep of ai ->
        // @ai-sdk/gateway -> @vercel/oidc.
        '@vercel/oidc',
        '@ai-sdk/gateway',
        // undici (SPEC-222, transitive via @repo/utils safe-fetch) uses dynamic
        // require("assert") internally; bundling it into the ESM output throws
        // "Dynamic require of assert is not supported" at startup. Externalize so
        // Node's CJS interop resolves it at runtime. Declared as a direct dep of
        // apps/api so pnpm installs it at apps/api/node_modules.
        'undici'
    ],
    noExternal: [
        /@repo\/.*/,
        '@repo/config',
        '@repo/db',
        '@repo/logger',
        '@repo/schemas',
        '@repo/utils',
        '@repo/service-core',
        '@repo/seed'
    ],
    esbuildOptions(options) {
        options.resolveExtensions = ['.ts', '.js', '.json'];
    }
});
