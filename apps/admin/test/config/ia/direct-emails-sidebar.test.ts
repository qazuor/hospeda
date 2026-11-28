/**
 * HOS-2685: the "Correos directos" group in the marketing sidebar and its
 * quick-create action are gated by the direct email permissions, so EDITOR
 * (which has the marketing section but none of them) never sees them.
 */

import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { createActions } from '@/config/ia/create-actions';
import { validatedConfig } from '@/config/ia/validate';
import { isPermissionGateGranted } from '@/lib/nav/permission-visibility';

function findGroup() {
    const group = validatedConfig.sidebars.marketingSidebar.items.find(
        (item) => item.id === 'direct-emails'
    );
    if (group?.type !== 'group') throw new Error('direct-emails group not found');
    return group;
}

describe('direct emails sidebar group', () => {
    it('is gated on DIRECT_EMAIL_VIEW', () => {
        expect(findGroup().permissions).toEqual(['DIRECT_EMAIL_VIEW']);
    });

    it('links the four screens with the right gates', () => {
        const links = Object.fromEntries(
            findGroup().items.flatMap((item) =>
                item.type === 'link' ? [[item.route, item.permissions]] : []
            )
        );

        expect(links).toEqual({
            '/direct-emails': ['DIRECT_EMAIL_VIEW'],
            '/direct-emails/new': ['DIRECT_EMAIL_SEND'],
            '/direct-emails/templates': ['DIRECT_EMAIL_VIEW'],
            '/direct-emails/suppressions': ['DIRECT_EMAIL_VIEW']
        });
    });

    it('shows for a holder of the permission and hides without it', () => {
        const gate = findGroup().permissions;

        expect(
            isPermissionGateGranted({
                gate,
                userPermissions: [PermissionEnum.DIRECT_EMAIL_VIEW]
            })
        ).toBe(true);
        expect(
            isPermissionGateGranted({
                gate,
                userPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW]
            })
        ).toBe(false);
    });

    it('registers a quick-create action gated by DIRECT_EMAIL_SEND', () => {
        expect(createActions.newDirectEmail).toMatchObject({
            route: '/direct-emails/new',
            permissions: ['DIRECT_EMAIL_SEND']
        });
    });
});
