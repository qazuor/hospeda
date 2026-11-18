/**
 * HOS-2335 follow-up (known gap U-5) — `get_help` links carry the locale the
 * binding resolved into the call context, and fall back to `es` without one.
 *
 * @module test/mcp/tools/help/get-help.locale
 */

import type { Actor } from '@repo/service-core';
import { beforeAll, describe, expect, it } from 'vitest';
import { getHelpTool } from '../../../../src/mcp/tools/help/get-help';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import { env, validateApiEnv } from '../../../../src/utils/env';

const actor = {
    id: '1f2e3d4c-5b6a-4789-8abc-def012345678',
    roles: ['HOST'],
    permissions: [],
    emailVerified: true
} as unknown as Actor;

describe('get_help links by locale', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    it.each(['es', 'en', 'pt'] as const)('prefixes the %s locale', async (locale) => {
        // A question with no match answers the FAQ and contact links, with no reads.
        const outcome = await runTool({
            definition: getHelpTool,
            actor,
            input: { question: 'zzzqqq xxxyyy' },
            context: { channel: 'mcp', locale }
        });

        expect(outcome.ok).toBe(true);
        const site = env.HOSPEDA_SITE_URL.replace(/\/+$/, '');
        const links = outcome.ok ? (outcome.data.fallbackLinks ?? []) : [];
        expect(links.length).toBeGreaterThan(0);
        for (const link of links) {
            expect(link.url.startsWith(`${site}/${locale}/`)).toBe(true);
        }
    });

    it('falls back to es when the context carries no locale', async () => {
        const outcome = await runTool({
            definition: getHelpTool,
            actor,
            input: { question: 'zzzqqq xxxyyy' },
            context: { channel: 'mcp' }
        });

        const site = env.HOSPEDA_SITE_URL.replace(/\/+$/, '');
        const links = outcome.ok ? (outcome.data.fallbackLinks ?? []) : [];
        expect(links.length).toBeGreaterThan(0);
        expect(links.every((link) => link.url.startsWith(`${site}/es/`))).toBe(true);
    });
});
