/**
 * @file platform-ops-cron.test.ts
 * @description Source-based tests for the cron jobs admin page relocated
 * from /billing/cron to /platform/ops/cron as part of SPEC-156 PR-2
 * (T-022). Confirms the route registration at the new path.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const cronSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/platform/ops/cron.tsx'),
    'utf8'
);

describe('platform/ops/cron.tsx (T-022)', () => {
    it('registers the new route path', () => {
        expect(cronSrc).toContain("createFileRoute('/_authed/platform/ops/cron')");
    });
});
