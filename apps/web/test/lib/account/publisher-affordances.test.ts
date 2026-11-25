import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PermissionEnum as P } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { buildHostQuickActions } from '@/lib/account/host-dashboard';

describe('host quick actions use target policies', () => {
    it('limits create-only hosts to their property action', () => {
        expect(
            buildHostQuickActions({ permissions: [P.ACCOMMODATION_CREATE] }).map((row) => row.id)
        ).toEqual(['properties']);
    });
    it('independently admits inbox and promotion targets', () => {
        expect(
            buildHostQuickActions({ permissions: [P.CONVERSATION_VIEW_OWN] }).map((row) => row.id)
        ).toEqual(['ownerMessages']);
        expect(
            buildHostQuickActions({ permissions: [P.OWNER_PROMOTION_VIEW_OWN] }).map(
                (row) => row.id
            )
        ).toEqual(['promotions']);
        expect(buildHostQuickActions({ permissions: [] })).toEqual([]);
    });
});

describe('SSR operation facts reach each direct consumer', () => {
    const page = (path: string) =>
        readFileSync(
            resolve(import.meta.dirname, '../../../src/pages/[lang]/mi-cuenta', path),
            'utf8'
        );
    it.each([
        ['publicaciones', 'post'],
        ['eventos', 'event']
    ])('wires effective create/edit facts on the %s list', (directory, area) => {
        const list = page(`${directory}/index.astro`);
        expect(list).toContain(
            `canCreate={canAccessPublisherArea({ area: '${area}Create', permissions: user.permissions })}`
        );
        expect(list).toContain(
            `canEdit={canAccessPublisherArea({ area: '${area}Edit', permissions: user.permissions })}`
        );
    });
    it('requires both read and update before offering a promotion editor', () => {
        expect(page('promociones/index.astro')).toContain(
            "canEdit={canAccessPublisherArea({ area: 'promotionEdit', permissions: user.permissions }) && canAccessPublisherArea({ area: 'promotions', permissions: user.permissions })}"
        );
    });
    it('uses target policies for both quick actions and the unread-stat link', () => {
        const host = page('host-dashboard.astro');
        expect(host).toContain('rows={buildHostQuickActions({ permissions: user.permissions })}');
        expect(host).toContain(
            "canViewInbox={canAccessPublisherArea({ area: 'inbox', permissions: user.permissions })}"
        );
    });
});
