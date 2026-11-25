import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PermissionEnum as P } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { buildAccountNavModel } from '@/lib/account-nav-model';

const read = (path: string) =>
    readFileSync(resolve(import.meta.dirname, '../../src', path), 'utf8');
const source = read('layouts/AccountLayout.astro');
const model = read('lib/account-nav-model.ts');
const sidebar = read('components/account/ui/AccountSidebar.tsx');
const view = read('components/account/ui/account-sidebar-view.ts');

describe('SSR publisher navigation wiring', () => {
    it('uses the shared model and effective permissions with no extra auth lookup', () => {
        expect(source).toContain('navModel={navModel}');
        expect(source).toContain('permissions: userPermissions');
        expect(source).toContain('Astro.locals.user?.permissions ?? []');
        expect(model).toContain('isVisibleByPermissions(node, permissions)');
        expect(model).toContain("surface: 'sidebar'");
        expect(model).toContain('PROVIDER_NAV_GROUP');
    });
    it('keeps tour targets owned by the configuration', () => {
        expect(view).toContain('tourTarget: item.item.tourTarget');
        expect(sidebar).toContain('data-tour={item.tourTarget}');
        expect(sidebar).not.toContain('function getTourTarget');
    });
    it('admits an independent inbox grant and denies retained roles without permission', () => {
        const base = {
            roles: ['HOST'],
            ownsHostTradeListing: false,
            mcpEnabled: false,
            activeSection: 'owner-messages'
        };
        const denied = buildAccountNavModel({ ...base, permissions: [] });
        expect(denied.groups.some((entry) => entry.group.id === 'anfitrion')).toBe(false);
        const granted = buildAccountNavModel({
            ...base,
            roles: ['USER'],
            permissions: [P.CONVERSATION_VIEW_OWN]
        });
        expect(
            granted.groups
                .find((entry) => entry.group.id === 'anfitrion')
                ?.items.map((entry) => entry.item.id)
        ).toEqual(['ownerMessages']);
    });
});
