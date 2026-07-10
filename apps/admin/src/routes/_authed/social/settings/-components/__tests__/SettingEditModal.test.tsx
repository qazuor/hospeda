// @vitest-environment jsdom
/**
 * Regression test for SettingEditModal (bug fix: stale form state on row switch).
 *
 * Before the fix, `value` was seeded once via `useState(item?.value ?? '')`
 * at mount time and never re-synced. Because the modal component stays
 * mounted across edits (the parent table only toggles `open`/`item`),
 * re-rendering with a DIFFERENT `item` while the modal was already showing
 * kept the PREVIOUS row's value in the input — editing a fresh row could
 * silently save the old row's value.
 *
 * The fix adds `useEffect([open, item])` to re-seed `value` whenever the
 * modal opens for a given row. This test renders with item A, then
 * re-renders with item B (same `open=true`), and asserts the input shows
 * B's value, not a stale A.
 *
 * @see ../SettingEditModal.tsx
 */

import type { SocialSetting } from '@repo/schemas';
import { render } from '@testing-library/react';
import type { ChangeEvent, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key
    })
}));

vi.mock('@/hooks/use-social-platform-settings', () => ({
    useUpdateSocialSetting: () => ({
        mutate: vi.fn(),
        isPending: false
    })
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

import { SettingEditModal } from '../SettingEditModal';

function buildSetting(overrides: Partial<SocialSetting> = {}): SocialSetting {
    return {
        id: '00000000-0000-4000-8000-000000000001',
        key: 'max_hashtags_instagram',
        value: '5',
        type: 'string',
        active: true,
        description: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        ...overrides
    };
}

describe('SettingEditModal', () => {
    it('re-seeds the value input when re-rendered for a different row while open', () => {
        const settingA = buildSetting({
            id: '00000000-0000-4000-8000-000000000001',
            key: 'max_hashtags_instagram',
            value: '5'
        });
        const settingB = buildSetting({
            id: '00000000-0000-4000-8000-000000000002',
            key: 'max_hashtags_facebook',
            value: '10'
        });

        const { rerender } = render(
            <SettingEditModal
                open={true}
                item={settingA}
                onOpenChange={vi.fn()}
            />
        );

        const inputA = document.getElementById('setting-value') as HTMLInputElement;
        expect(inputA.value).toBe('5');

        rerender(
            <SettingEditModal
                open={true}
                item={settingB}
                onOpenChange={vi.fn()}
            />
        );

        const inputB = document.getElementById('setting-value') as HTMLInputElement;
        expect(inputB.value).toBe('10');
    });

    it('shows an empty value for a secret-typed setting even if the previous row had a plain value', () => {
        const plainSetting = buildSetting({ type: 'string', value: 'plain-value' });
        const secretSetting = buildSetting({
            id: '00000000-0000-4000-8000-000000000003',
            key: 'make_api_key',
            type: 'secret',
            value: '***'
        });

        const { rerender } = render(
            <SettingEditModal
                open={true}
                item={plainSetting}
                onOpenChange={vi.fn()}
            />
        );
        expect((document.getElementById('setting-value') as HTMLInputElement).value).toBe(
            'plain-value'
        );

        rerender(
            <SettingEditModal
                open={true}
                item={secretSetting}
                onOpenChange={vi.fn()}
            />
        );
        expect((document.getElementById('setting-value') as HTMLInputElement).value).toBe('');
    });

    it('renders nothing when item is null', () => {
        const { container } = render(
            <SettingEditModal
                open={false}
                item={null}
                onOpenChange={vi.fn()}
            />
        );
        expect(container).toBeEmptyDOMElement();
    });
});
