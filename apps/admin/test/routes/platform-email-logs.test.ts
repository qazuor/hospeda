/**
 * @file platform-email-logs.test.ts
 * @description Source-based tests for the notification logs admin page
 * relocated from /billing/notification-logs to /platform/email/logs as
 * part of SPEC-156 PR-2 (T-024). The page is recategorized under the
 * email infrastructure namespace (not billing) per the IA.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const logsSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/platform/email/logs.tsx'),
    'utf8'
);

describe('platform/email/logs.tsx (T-024)', () => {
    it('registers the new route path', () => {
        expect(logsSrc).toContain("createFileRoute('/_authed/platform/email/logs')");
    });
});
