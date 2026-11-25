import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { VenueIcon } from '@repo/icons';
import { PermissionEnum as P } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_DISCOVERY_DOORS } from '@/config/discovery-doors';
import { buildAccountNavModel } from '@/lib/account-nav-model';

const read = (path: string) =>
    readFileSync(resolve(import.meta.dirname, '../../src', path), 'utf8');
const sidebar = read('components/account/ui/AccountSidebar.tsx');
const view = read('components/account/ui/account-sidebar-view.ts');

describe('exclusive account discovery doors', () => {
    it('preserves the venue icon and hub option content', () => {
        expect(
            ACCOUNT_DISCOVERY_DOORS.find((door) => door.id === 'listing')?.options.find(
                (option) => option.id === 'venue'
            )?.icon
        ).toBe(VenueIcon);
    });
    it.each([
        { permissions: [], expected: 'listing', href: 'planes' },
        { permissions: [P.ACCOMMODATION_CREATE], expected: 'partner', href: 'mi-cuenta/aliados' },
        { permissions: [], ownsPartner: true, expected: 'partner', href: 'mi-cuenta/aliados' },
        {
            permissions: [],
            ownsHostTradeListing: true,
            expected: 'partner',
            href: 'mi-cuenta/aliados'
        }
    ])('selects the fixed door for %j independently of MCP', ({ expected, href, ...facts }) => {
        for (const mcpEnabled of [false, true]) {
            const model = buildAccountNavModel({
                roles: ['USER'],
                ownsHostTradeListing: false,
                activeSection: 'editar',
                mcpEnabled,
                ...facts
            });
            expect(model.doors.map((entry) => entry.door.id)).toEqual([expected]);
            expect(model.doors[0]?.door.href).toBe(href);
            expect(model.doors[0]?.labelKey).toBe(model.doors[0]?.door.i18nKey);
        }
    });
    it('renders normal locale-aware links after management groups', () => {
        expect(view).toContain('href: buildUrl({ locale, path: door.door.href })');
        expect(view).toContain('label: t(door.labelKey)');
        expect(sidebar.indexOf('view.doors.length > 0')).toBeGreaterThan(
            sidebar.indexOf('view.groups.map(')
        );
        expect(sidebar).toContain("data-door={door ? '' : undefined}");
        expect(sidebar).toContain("aria-current={item.active ? 'page' : undefined}");
    });
});
