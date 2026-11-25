/**
 * HOS-2540 static guard: the API points the email logo at its own origin.
 *
 * `@repo/email` defaults the logo to production. If the call that configures it
 * disappears from `apps/api/src/index.ts`, every unit test stays green and
 * staging emails quietly go back to a broken logo. `index.ts` boots the server
 * on import, so this reads the source and anchors on symbols, not on formatting.
 * The call must also sit before the first place an email can be rendered.
 *
 * @module test/services/email-preview/email-assets-registration.guard
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(resolve(HERE, '../../../src/index.ts'), 'utf8');

describe('HOS-2540: email assets are configured at API startup', () => {
    it('imports configureEmailAssets from @repo/email', () => {
        expect(indexSource).toMatch(
            /import\s*\{[^}]*\bconfigureEmailAssets\b[^}]*\}\s*from\s*'@repo\/email'/s
        );
    });

    it('passes the validated HOSPEDA_SITE_URL', () => {
        expect(indexSource).toMatch(
            /configureEmailAssets\(\s*\{\s*siteUrl:\s*env\.HOSPEDA_SITE_URL\s*[,}]/
        );
    });

    it('passes no open-pixel origin (HOS-2583)', () => {
        expect(indexSource).not.toMatch(/pixelBaseUrl|checkEmailPixelBaseUrl/);
    });

    it('runs after env validation and before the cron scheduler starts', () => {
        const validated = indexSource.indexOf('validateApiEnv();');
        const configured = indexSource.search(/configureEmailAssets\(\s*\{/);
        const cron = indexSource.indexOf('startCronScheduler()');

        expect(validated).toBeGreaterThan(-1);
        expect(configured).toBeGreaterThan(validated);
        expect(cron).toBeGreaterThan(configured);
    });
});
