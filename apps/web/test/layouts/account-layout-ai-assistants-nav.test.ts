/**
 * @file account-layout-ai-assistants-nav.test.ts
 * @description HOS-2184 T-028. The "Asistentes de IA" sidebar entry exists in the
 * single-source nav config and the account layout shows it only while the MCP
 * feature is on, without a per-request round trip.
 *
 * Astro components cannot be rendered in Vitest, so the layout is checked at
 * source level, like the sibling `account-layout-*` tests.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    ACCOUNT_NAV_GROUPS,
    AI_ASSISTANTS_NAV_ITEM_ID,
    getNavForSurface
} from '../../src/config/navigation';
import { AI_ASSISTANTS_PATH } from '../../src/lib/routes';

const layout = readFileSync(resolve(__dirname, '../../src/layouts/AccountLayout.astro'), 'utf8');

describe('AI assistants nav entry', () => {
    it('lives in the "cuenta" group, next to Preferencias, pointing at the panel', () => {
        const group = ACCOUNT_NAV_GROUPS.find((candidate) => candidate.id === 'cuenta');
        const item = group?.items.find((candidate) => candidate.id === AI_ASSISTANTS_NAV_ITEM_ID);

        expect(item?.href).toBe(AI_ASSISTANTS_PATH);
        expect(item?.i18nKey).toBe('account.nav.aiAssistants');
    });

    it('is sidebar-only, because the client menus cannot know the feature flag', () => {
        const alwaysVisible = () => true;
        const ids = (surface: 'sidebar' | 'mobile' | 'avatar') =>
            getNavForSurface({ surface, visibility: alwaysVisible }).groups.flatMap((group) =>
                group.items.map((item) => item.id)
            );

        expect(ids('sidebar')).toContain(AI_ASSISTANTS_NAV_ITEM_ID);
        expect(ids('mobile')).not.toContain(AI_ASSISTANTS_NAV_ITEM_ID);
        expect(ids('avatar')).not.toContain(AI_ASSISTANTS_NAV_ITEM_ID);
    });
});

describe('AccountLayout gating of the AI assistants entry', () => {
    it('filters the entry out unless the MCP URL is published', () => {
        expect(layout).toContain('getConfiguredMcpUrl');
        expect(layout).toMatch(/mcpEnabled \|\| item\.id !== AI_ASSISTANTS_NAV_ITEM_ID/);
    });
});
