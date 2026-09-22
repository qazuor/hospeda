/**
 * HOS-392 regression guard — the `e2e:build` script must pin a production build.
 *
 * ## What broke
 *
 * `apps/admin/.env.local` carries `NODE_ENV=development`. That file is
 * gitignored, so it exists on every developer machine and on none of the CI
 * runners. Vite derives `config.isProduction` — and therefore
 * `import.meta.env.PROD` and the JSX runtime it compiles against — from
 * `process.env.NODE_ENV`, falling back to whatever the loaded env files say
 * when the variable is not already set in the environment. So `vite build`
 * run from a developer machine emitted the DEVELOPMENT JSX runtime into the
 * production Nitro bundle, and `apps/admin/.output/server/index.mjs` died at
 * startup with `TypeError: (0 , n.jsxDEV) is not a function`. Playwright boots
 * all three `webServer` entries regardless of `--project`, so that killed
 * every local E2E run, including specs that never touch the admin.
 *
 * CI never saw it because the E2E workflows set `VITE_SENTRY_DSN` at the job
 * level and have no `.env.local` to downgrade `NODE_ENV`. The divergence
 * between the two environments was the actual defect; pinning both values
 * inside the script is what removes it.
 *
 * ## What this guard asserts
 *
 * Only that the `e2e:build` script text still pins `NODE_ENV=production` and
 * still passes a `VITE_SENTRY_DSN` placeholder (which the admin env schema
 * requires as soon as the build is a production one). It does NOT inspect the
 * built bundle — that would need a full build — so it cannot prove the output
 * is free of `jsxDEV`; it only stops the two settings that made it so from
 * being dropped again.
 *
 * @see https://linear.app/hospeda-beta/issue/HOS-392
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const E2E_ROOT = join(import.meta.dirname, '..', '..');

/** The `scripts` block of `apps/e2e/package.json`. */
const scripts: Record<string, string> = JSON.parse(
    readFileSync(join(E2E_ROOT, 'package.json'), 'utf-8')
).scripts;

describe('HOS-392: e2e:build pins a production build', () => {
    it('defines an e2e:build script', () => {
        // Arrange / Act
        const script = scripts['e2e:build'];

        // Assert
        expect(script, 'apps/e2e/package.json must define an `e2e:build` script').toBeTypeOf(
            'string'
        );
    });

    it('pins NODE_ENV=production so a developer .env.local cannot downgrade the bundle', () => {
        // Arrange
        const script = scripts['e2e:build'] ?? '';

        // Act: the assignment must be a standalone token, not a substring of
        // something like `HOSPEDA_NODE_ENV=production` or `NODE_ENV=production-ish`.
        const pinsProduction = /(^|\s)NODE_ENV=production(\s|$)/.test(script);

        // Assert
        expect(
            pinsProduction,
            'e2e:build must set NODE_ENV=production. Without it, Vite reads NODE_ENV from ' +
                'apps/admin/.env.local (development) and emits the jsxDEV runtime into the ' +
                'production admin bundle, which then crashes on startup (HOS-392).'
        ).toBe(true);
    });

    it('supplies the VITE_SENTRY_DSN placeholder the admin production build requires', () => {
        // Arrange
        const script = scripts['e2e:build'] ?? '';

        // Act: a non-empty value, since the admin schema rejects an empty string.
        const suppliesDsn = /(^|\s)VITE_SENTRY_DSN=\S+/.test(script);

        // Assert
        expect(
            suppliesDsn,
            'e2e:build must pass a non-empty VITE_SENTRY_DSN placeholder. The admin env ' +
                'schema requires it whenever `import.meta.env.PROD` is true, which pinning ' +
                'NODE_ENV=production makes it (HOS-392).'
        ).toBe(true);
    });

    it('sets both before the turbo invocation, so they reach the build', () => {
        // Arrange
        const script = scripts['e2e:build'] ?? '';

        // Act
        const turboIndex = script.indexOf('turbo run build');
        const nodeEnvIndex = script.indexOf('NODE_ENV=production');
        const dsnIndex = script.indexOf('VITE_SENTRY_DSN=');

        // Assert
        expect(turboIndex, 'e2e:build must invoke `turbo run build`').toBeGreaterThan(-1);
        expect(
            nodeEnvIndex > -1 && nodeEnvIndex < turboIndex,
            'NODE_ENV=production must precede `turbo run build` to be part of its environment'
        ).toBe(true);
        expect(
            dsnIndex > -1 && dsnIndex < turboIndex,
            'VITE_SENTRY_DSN must precede `turbo run build` to be part of its environment'
        ).toBe(true);
    });
});
