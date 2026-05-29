/**
 * @file platform-ops-webhooks.test.ts
 * @description Source-based tests for the webhook events admin page
 * relocated from /billing/webhook-events to /platform/ops/webhooks as
 * part of SPEC-156 PR-2 (T-023). Confirms the route registration at
 * the new path.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webhooksSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/platform/ops/webhooks.tsx'),
    'utf8'
);

describe('platform/ops/webhooks.tsx (T-023)', () => {
    it('registers the new route path', () => {
        expect(webhooksSrc).toContain("createFileRoute('/_authed/platform/ops/webhooks')");
    });
});
