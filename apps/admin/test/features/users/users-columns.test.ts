/**
 * Tests for the users DataTable column configuration. Verifies SPEC-135 F-030:
 * the `fullName` compound column and the `slug` column are hidden by default
 * on the table view so mobile (where columns silently drop on overflow)
 * surfaces email instead of two redundant name columns.
 *
 * HOS-296: the `role` column itself was removed — see the test below.
 */

import type { TranslationKey } from '@repo/i18n';
import { describe, expect, it } from 'vitest';
import { createUsersColumns } from '@/features/users/config/users.columns';

const t = (key: TranslationKey | string) => String(key);

describe('createUsersColumns', () => {
    const columns = createUsersColumns(t as Parameters<typeof createUsersColumns>[0]);

    const byId = (id: string) => columns.find((c) => c.id === id);

    it('hides fullName from the default table view (F-030)', () => {
        const fullName = byId('fullName');
        expect(fullName).toBeDefined();
        expect(fullName?.startVisibleOnTable).toBe(false);
    });

    it('hides slug from the default table view (F-030)', () => {
        const slug = byId('slug');
        expect(slug).toBeDefined();
        expect(slug?.startVisibleOnTable).toBe(false);
    });

    it('keeps displayName visible on the table view', () => {
        const displayName = byId('displayName');
        expect(displayName).toBeDefined();
        // No explicit false flag — defaults to visible.
        expect(displayName?.startVisibleOnTable).not.toBe(false);
    });

    it('keeps email visible on the table view (mobile priority)', () => {
        const email = byId('email');
        expect(email).toBeDefined();
        expect(email?.startVisibleOnTable).not.toBe(false);
    });

    // HOS-296: the role column was removed entirely — `role` no longer exists
    // on the admin user LIST payload (`UserListItemSchema` drops it; see
    // users.columns.ts), so there is nothing to render a column for.
    it('no longer defines a role column', () => {
        expect(byId('role')).toBeUndefined();
    });

    it('keeps lifecycle status visible on the table view', () => {
        const lifecycle = byId('lifecycleState');
        expect(lifecycle).toBeDefined();
        expect(lifecycle?.startVisibleOnTable).not.toBe(false);
    });
});
