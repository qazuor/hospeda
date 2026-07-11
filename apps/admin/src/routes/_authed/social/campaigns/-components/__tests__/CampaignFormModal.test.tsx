// @vitest-environment jsdom
/**
 * Regression test for CampaignFormModal (bug fix: stale form state on row switch).
 *
 * Before the fix, `form` was seeded once via `useState(item ? itemToForm(item) : EMPTY_FORM)`
 * at mount time and never re-synced. Because the modal component stays mounted
 * across edits (the parent table only toggles `open`/`item`), re-rendering
 * with a DIFFERENT `item` while the modal was already showing kept the
 * PREVIOUS row's values in the form — editing a fresh campaign could
 * silently save the old campaign's name/description onto a different row.
 *
 * The fix adds `useEffect([open, item])` to re-seed `form` whenever the
 * modal opens for a given row. This test renders with item A, then
 * re-renders with item B (same `open=true`), and asserts the name input
 * shows B's name, not a stale A.
 *
 * @see ../CampaignFormModal.tsx
 */

import type { SocialCampaign } from '@repo/schemas';
import { render } from '@testing-library/react';
import type { ChangeEvent, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key
    })
}));

vi.mock('@/hooks/use-social-catalog', () => ({
    useCreateSocialCampaign: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateSocialCampaign: () => ({ mutate: vi.fn(), isPending: false })
}));

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children, open }: { children: ReactNode; open?: boolean }) =>
        open ? <div>{children}</div> : null,
    DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

vi.mock('@/components/ui/button', () => ({
    Button: ({
        children,
        onClick,
        disabled,
        type
    }: {
        children: ReactNode;
        onClick?: () => void;
        disabled?: boolean;
        type?: 'button' | 'submit';
    }) => (
        <button
            type={type === 'submit' ? 'submit' : 'button'}
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    )
}));

vi.mock('@/components/ui/input', () => ({
    Input: ({
        id,
        value,
        onChange,
        type
    }: {
        id?: string;
        value?: string;
        type?: string;
        onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
    }) => (
        <input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
        />
    )
}));

vi.mock('@/components/ui/label', () => ({
    Label: ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
        <label htmlFor={htmlFor}>{children}</label>
    )
}));

vi.mock('@/components/ui/textarea', () => ({
    Textarea: ({
        id,
        value,
        onChange
    }: {
        id?: string;
        value?: string;
        onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
    }) => (
        <textarea
            id={id}
            value={value}
            onChange={onChange}
        />
    )
}));

import { CampaignFormModal } from '../CampaignFormModal';

function buildCampaign(overrides: Partial<SocialCampaign> = {}): SocialCampaign {
    return {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Institucional Hospeda',
        slug: 'institucional-hospeda',
        description: 'Campaign A description',
        active: true,
        startsAt: null,
        endsAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdById: null,
        updatedById: null,
        deletedAt: null,
        deletedById: null,
        ...overrides
    };
}

describe('CampaignFormModal', () => {
    it('re-seeds the name input when re-rendered for a different row while open', () => {
        const campaignA = buildCampaign({
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Campaign A'
        });
        const campaignB = buildCampaign({
            id: '00000000-0000-4000-8000-000000000002',
            name: 'Campaign B'
        });

        const { rerender } = render(
            <CampaignFormModal
                open={true}
                item={campaignA}
                onOpenChange={vi.fn()}
            />
        );

        const nameInputA = document.getElementById('campaign-name') as HTMLInputElement;
        expect(nameInputA.value).toBe('Campaign A');

        rerender(
            <CampaignFormModal
                open={true}
                item={campaignB}
                onOpenChange={vi.fn()}
            />
        );

        const nameInputB = document.getElementById('campaign-name') as HTMLInputElement;
        expect(nameInputB.value).toBe('Campaign B');
    });

    it('resets to an empty form when switching from an edit row to create mode (item=null)', () => {
        const campaignA = buildCampaign({ name: 'Campaign A' });

        const { rerender } = render(
            <CampaignFormModal
                open={true}
                item={campaignA}
                onOpenChange={vi.fn()}
            />
        );
        expect((document.getElementById('campaign-name') as HTMLInputElement).value).toBe(
            'Campaign A'
        );

        rerender(
            <CampaignFormModal
                open={true}
                item={null}
                onOpenChange={vi.fn()}
            />
        );
        expect((document.getElementById('campaign-name') as HTMLInputElement).value).toBe('');
    });
});
