/**
 * HOS-2519 AC-7.1: the "Emails" entry in Plataforma → Configuración general.
 *
 * The menu gate must equal the route gate (`RoutePermissionGuard` on
 * `/platform/emails` and both API routes use `NOTIFICATION_TEMPLATE_PREVIEW`,
 * the HOS-981 rule), the group must list the permission or it hides for a role
 * holding only that one, and the link is hidden (not disabled) without it.
 */

import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { validatedConfig } from '@/config/ia/validate';
import { isPermissionGateGranted } from '@/lib/nav/permission-visibility';

function findConfigGeneral() {
    const group = validatedConfig.sidebars.plataformaSidebar.items.find(
        (item) => item.id === 'config-general'
    );
    if (group?.type !== 'group') {
        throw new Error('config-general group not found in plataformaSidebar');
    }
    return group;
}

function findEmailPreviewsLink() {
    const link = findConfigGeneral().items.find((item) => item.id === 'email-previews');
    if (link?.type !== 'link') {
        throw new Error('email-previews link not found in config-general');
    }
    return link;
}

describe('HOS-2519 email previews sidebar entry', () => {
    it('points to /platform/emails with the "Emails" label', () => {
        const link = findEmailPreviewsLink();

        expect(link.route).toBe('/platform/emails');
        expect(link.label.es).toBe('Emails');
    });

    it('is gated on exactly NOTIFICATION_TEMPLATE_PREVIEW and hides without it', () => {
        const link = findEmailPreviewsLink();

        expect(link.permissions).toEqual(['NOTIFICATION_TEMPLATE_PREVIEW']);
        expect(link.onMissing).toBe('hide');
    });

    it('the group gate includes the permission, so the group shows for a previewer-only role', () => {
        const group = findConfigGeneral();

        expect(group.permissions).toContain('NOTIFICATION_TEMPLATE_PREVIEW');
        expect(
            isPermissionGateGranted({
                gate: group.permissions,
                userPermissions: [PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW]
            })
        ).toBe(true);
    });

    it('grants the link to a holder and refuses it otherwise', () => {
        const link = findEmailPreviewsLink();

        expect(
            isPermissionGateGranted({
                gate: link.permissions,
                userPermissions: [PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW]
            })
        ).toBe(true);
        expect(
            isPermissionGateGranted({
                gate: link.permissions,
                userPermissions: [PermissionEnum.SETTINGS_MANAGE, PermissionEnum.SEO_MANAGE]
            })
        ).toBe(false);
    });
});
