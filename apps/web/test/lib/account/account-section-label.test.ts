/** Sidebar, mobile bar and nested breadcrumbs share the navigation label source. */
import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { buildSidebarView } from '../../../src/components/account/ui/account-sidebar-view';
import { buildAccountNavModel, getAccountSectionLabel } from '../../../src/lib/account-nav-model';
import { createT } from '../../../src/lib/i18n';

describe('account section labels', () => {
    it.each(['es', 'en', 'pt'] as const)('matches sidebar and bar labels in %s', (locale) => {
        const t = createT(locale);
        for (const section of [
            'propiedades',
            'comercio-venue',
            'comercio-experience',
            'messages',
            'owner-messages',
            'publicaciones',
            'eventos',
            'promociones',
            'directorio-proveedores',
            'favoritos',
            'asistentes-ia'
        ]) {
            const model = buildAccountNavModel({
                roles: null,
                permissions: Object.values(PermissionEnum),
                ownsHostTradeListing: true,
                ownsPartner: true,
                mcpEnabled: true,
                hasSubscription: true,
                activeSection: section
            });
            const view = buildSidebarView({ model, locale });
            const item = view.groups.flatMap((group) => group.items).find((entry) => entry.active);
            expect(item, section).toBeDefined();
            expect(getAccountSectionLabel({ t, section })).toBe(item?.label);
            expect(getAccountSectionLabel({ t, section })).toBe(view.activeLabel);
        }
    });

    it('uses the accommodation sidebar label rather than the editor legacy label', () => {
        expect(getAccountSectionLabel({ t: createT('es'), section: 'propiedades' })).toBe(
            'Mis alojamientos'
        );
    });
});
