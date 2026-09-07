/**
 * @file announcements/index.test.ts
 * @description Tests for the announcements list page added in SPEC-156 PR-4
 * (T-038). Most of this file is source-based (route path, permission gate,
 * hook wiring, render-branch markup) — that is PRE-EXISTING and intentionally
 * untouched by HOS-1198; see the owner-tracked follow-up issue for draining
 * it. The `delete flow` describe block is the one HOS-1198 exception: the
 * old confirm() migration to DeleteConfirmDialog broke one substring
 * assertion here (`items.filter((item) => item.id !== id)`, since the
 * variable is now `idToDelete`), and a substring can't tell a correct filter
 * from an inverted one anyway — so that block is rewritten as a real
 * behavior test instead of patched.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AnnouncementItem } from '@repo/schemas';
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route as AnnouncementsListRoute } from '@/routes/_authed/platform/critical/announcements';
import { renderWithProviders } from '../../../../helpers/render-with-providers';

const listSrc = readFileSync(
    resolve(
        __dirname,
        '../../../../../src/routes/_authed/platform/critical/announcements/index.tsx'
    ),
    'utf8'
);

// ── Mocks for the `delete flow` behavior tests only ─────────────────────────
// (the source-based describes above/below never render anything, so these
// have no effect on them)

const { mockMutate } = vi.hoisted(() => ({ mockMutate: vi.fn() }));

vi.mock('@/hooks/use-flashy-toast', () => ({
    useFlashyToast: () => ({ success: vi.fn(), error: vi.fn() })
}));

const ITEM_A: AnnouncementItem = {
    id: '11111111-1111-4111-8111-111111111111',
    text: { es: 'Aviso A', en: 'Notice A', pt: 'Aviso A' },
    variant: 'info',
    dismissible: true
};
const ITEM_B: AnnouncementItem = {
    id: '22222222-2222-4222-8222-222222222222',
    text: { es: 'Aviso B', en: 'Notice B', pt: 'Aviso B' },
    variant: 'warning',
    dismissible: false
};
const ITEM_C: AnnouncementItem = {
    id: '33333333-3333-4333-8333-333333333333',
    text: { es: 'Aviso C', en: 'Notice C', pt: 'Aviso C' },
    variant: 'danger',
    dismissible: true
};

vi.mock('@/hooks/use-platform-setting', () => ({
    usePlatformSetting: () => ({
        data: { row: { value: [ITEM_A, ITEM_B, ITEM_C] }, legacyValue: null },
        isLoading: false,
        isError: false
    }),
    useUpdatePlatformSetting: () => ({
        mutate: mockMutate,
        isPending: false
    })
}));

describe('platform/critical/announcements/index.tsx (T-038)', () => {
    it('registers the new route path', () => {
        expect(listSrc).toContain("createFileRoute('/_authed/platform/critical/announcements/')");
    });

    describe('permission gate', () => {
        it('requires MAINTENANCE_MODE_WRITE (SUPER_ADMIN-only)', () => {
            expect(listSrc).toContain('PermissionEnum.MAINTENANCE_MODE_WRITE');
        });

        it('redirects to /auth/forbidden when the perm is missing', () => {
            expect(listSrc).toContain("throw redirect({ to: '/auth/forbidden' })");
        });
    });

    describe('data wiring', () => {
        it('reads announcements.global via usePlatformSetting (no legacy adapter)', () => {
            expect(listSrc).toContain("key: 'announcements.global'");
            expect(listSrc).toContain('usePlatformSetting');
        });

        it('writes via useUpdatePlatformSetting on delete', () => {
            expect(listSrc).toContain('useUpdatePlatformSetting');
            expect(listSrc).toContain('mutation.mutate(next');
        });
    });

    describe('delete flow', () => {
        beforeEach(() => {
            mockMutate.mockClear();
        });

        function renderPage() {
            const Page = AnnouncementsListRoute.options.component;
            if (!Page) throw new Error('Component not found in Route.options');
            return renderWithProviders(<Page />);
        }

        /** Finds the delete button for a given item id among the rendered rows. */
        function getDeleteButtonFor(id: string) {
            const row = screen
                .getAllByTestId('announcement-row')
                .find((el) => el.getAttribute('data-announcement-id') === id);
            if (!row) throw new Error(`row not found for id ${id}`);
            return within(row).getByTestId('delete-announcement-button');
        }

        it('opens the confirm dialog on click and does NOT call mutate yet', () => {
            renderPage();

            fireEvent.click(getDeleteButtonFor(ITEM_A.id));

            expect(screen.getByTestId('delete-confirm-dialog')).toBeInTheDocument();
            expect(mockMutate).not.toHaveBeenCalled();
        });

        it('confirming deletion filters out only the deleted item, keeping the others intact', () => {
            renderPage();

            fireEvent.click(getDeleteButtonFor(ITEM_B.id));
            fireEvent.click(screen.getByTestId('delete-confirm-confirm'));

            expect(mockMutate).toHaveBeenCalledOnce();
            // The assertion that matters: the ARGUMENT mutate received, not
            // just that it was called — a `toContain` on the source can't
            // tell a correct filter from an inverted one, this can.
            expect(mockMutate.mock.calls[0]?.[0]).toEqual([ITEM_A, ITEM_C]);
        });

        it('does NOT call mutate when the dialog is dismissed via cancel', () => {
            renderPage();

            fireEvent.click(getDeleteButtonFor(ITEM_C.id));
            fireEvent.click(screen.getByTestId('delete-confirm-cancel'));

            expect(mockMutate).not.toHaveBeenCalled();
            expect(screen.queryByTestId('delete-confirm-dialog')).not.toBeInTheDocument();
        });
    });

    describe('render branches', () => {
        it('shows loading state', () => {
            expect(listSrc).toContain('data-testid="announcements-loading"');
        });

        it('shows empty state when items.length === 0', () => {
            expect(listSrc).toContain('data-testid="announcements-empty"');
            expect(listSrc).toContain('items.length === 0');
        });

        it('renders the list when items are present', () => {
            expect(listSrc).toContain('data-testid="announcements-list"');
            expect(listSrc).toContain('items.length > 0');
        });

        it('exposes per-row data-announcement-id + edit + delete affordances', () => {
            expect(listSrc).toContain('data-testid="announcement-row"');
            expect(listSrc).toContain('data-announcement-id');
            expect(listSrc).toContain('data-testid="edit-announcement-link"');
            expect(listSrc).toContain('data-testid="delete-announcement-button"');
        });

        it('links the New CTA at /platform/critical/announcements/new', () => {
            expect(listSrc).toContain('data-testid="new-announcement-link"');
            expect(listSrc).toContain('to="/platform/critical/announcements/new"');
        });

        it('links the Edit button to /platform/critical/announcements/$id/edit', () => {
            expect(listSrc).toContain('to="/platform/critical/announcements/$id/edit"');
        });
    });
});
