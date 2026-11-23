/**
 * @file account-layout-ai-assistants-nav.test.ts
 * @description HOS-2184 T-028, HOS-2562. The "Asistentes de IA" sidebar entry
 * exists in the single-source nav config, and the account layout lists it only
 * for a real client (shared `isRealClient`, from the effective permissions)
 * while the MCP feature is on. Nobody else gets a hidden copy or a reveal
 * island (the HOS-2430 reveal is gone).
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
import { getCuratedAccountNav } from '../../src/lib/nav-avatar';
import { AI_ASSISTANTS_PATH } from '../../src/lib/routes';

const layout = readFileSync(resolve(__dirname, '../../src/layouts/AccountLayout.astro'), 'utf8');

describe('AI assistants nav entry', () => {
    it('lives in the "cuenta" group, next to Preferencias, pointing at the panel', () => {
        const group = ACCOUNT_NAV_GROUPS.find((candidate) => candidate.id === 'cuenta');
        const item = group?.items.find((candidate) => candidate.id === AI_ASSISTANTS_NAV_ITEM_ID);

        expect(item?.href).toBe(AI_ASSISTANTS_PATH);
        expect(item?.i18nKey).toBe('account.nav.aiAssistants');
    });

    it('is a sidebar item; the menus append it explicitly and the avatar surface stays fixed', () => {
        const alwaysVisible = () => true;
        const ids = (surface: 'sidebar' | 'mobile' | 'avatar') =>
            getNavForSurface({ surface, visibility: alwaysVisible }).groups.flatMap((group) =>
                group.items.map((item) => item.id)
            );

        expect(ids('sidebar')).toContain(AI_ASSISTANTS_NAV_ITEM_ID);
        expect(ids('mobile')).not.toContain(AI_ASSISTANTS_NAV_ITEM_ID);
        expect(ids('avatar')).not.toContain(AI_ASSISTANTS_NAV_ITEM_ID);
    });

    it('is never part of the header menus (HOS-2551)', () => {
        const nav = getCuratedAccountNav({
            permissions: ['accommodation.create'],
            ownsHostTradeListing: true
        });
        const ids = [nav.dashboardItem?.id, ...nav.adminItems.map((item) => item.id)];
        expect(ids).not.toContain(AI_ASSISTANTS_NAV_ITEM_ID);
    });
});

describe('AccountLayout gating of the AI assistants entry', () => {
    it('hands the model the effective permissions and the MCP flag, and renders no hidden copy', () => {
        const shell = readFileSync(
            resolve(__dirname, '../../src/layouts/AccountShell.astro'),
            'utf8'
        );
        expect(layout).toContain('getConfiguredMcpUrl');
        expect(layout).toMatch(/permissions: userPermissions/);
        expect(layout).toMatch(/Astro\.locals\.user\?\.permissions/);
        for (const source of [layout, shell]) {
            expect(source).not.toContain('AiAssistantsNavReveal');
            expect(source).not.toContain('data-ai-assistants-entry');
            expect(source).not.toContain('hiddenUntilRevealed');
            expect(source).not.toContain('aiAssistantsHidden');
        }
    });

    it('no longer passes the flag to the header menus, which do not list the entry (HOS-2551)', () => {
        const header = readFileSync(resolve(__dirname, '../../src/layouts/Header.astro'), 'utf8');
        expect(header).not.toContain('mcpEnabled');
    });
});
