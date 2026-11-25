/** History regressions now belong to the shared navigation-dialog helper. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNavigationDialog } from '../../../../src/hooks/use-navigation-dialog';

const calls = vi.hoisted(() => ({
    order: [] as string[],
    navigate: vi.fn(),
    acquire: vi.fn(),
    after: vi.fn()
}));
vi.mock('../../../../src/lib/dialog-history', () => ({
    acquireDialogHistoryEntry: (params: { onPopped: () => void }) => {
        calls.acquire(params);
        return { release: () => calls.order.push('release') };
    }
}));
vi.mock('astro:transitions/client', () => ({
    navigate: (href: string) => {
        calls.order.push('navigate');
        calls.navigate(href);
        return Promise.resolve();
    }
}));

function Harness() {
    const [open, setOpen] = useState(true);
    const close = useCallback(() => setOpen(false), []);
    const { onLinkClick, closeThen } = useNavigationDialog({ open, onClose: close });
    return (
        <>
            <a
                href="/es/mi-cuenta/"
                onClick={onLinkClick}
            >
                Account
            </a>
            <button
                type="button"
                onClick={() => closeThen({ afterClose: calls.after })}
            >
                Handoff
            </button>
            <span>{String(open)}</span>
        </>
    );
}

describe('shared navigation-dialog history unwind', () => {
    beforeEach(() => {
        calls.order.length = 0;
        vi.clearAllMocks();
    });
    it('releases before navigating exactly once on popstate or fallback', async () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole('link'));
        act(() => window.dispatchEvent(new PopStateEvent('popstate')));
        await waitFor(() => expect(calls.navigate).toHaveBeenCalledTimes(1));
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(calls.navigate).toHaveBeenCalledTimes(1);
        expect(calls.order).toEqual(['release', 'navigate']);
    });
    it('continues on fallback when no entry was claimed', async () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole('button'));
        await waitFor(() => expect(calls.after).toHaveBeenCalledTimes(1));
        expect(calls.order).toEqual(['release']);
    });
    it.each([
        { ctrlKey: true },
        { metaKey: true },
        { shiftKey: true },
        { altKey: true },
        { button: 1 }
    ])('preserves modified clicks %j', (modifiers) => {
        render(<Harness />);
        expect(fireEvent.click(screen.getByRole('link'), modifiers)).toBe(true);
        expect(calls.navigate).not.toHaveBeenCalled();
    });
    it.each(['_blank', 'named-frame'])('preserves target %s', (target) => {
        render(<Harness />);
        screen.getByRole('link').setAttribute('target', target);
        expect(fireEvent.click(screen.getByRole('link'))).toBe(true);
        expect(calls.navigate).not.toHaveBeenCalled();
    });
    it('preserves external and download links', () => {
        render(<Harness />);
        const link = screen.getByRole('link');
        link.setAttribute('href', 'https://example.com/');
        expect(fireEvent.click(link)).toBe(true);
        link.setAttribute('href', '/download');
        link.setAttribute('download', 'file');
        expect(fireEvent.click(link)).toBe(true);
        expect(calls.navigate).not.toHaveBeenCalled();
    });
    it('cancels a pending continuation on a page swap', async () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole('link'));
        act(() => document.dispatchEvent(new Event('astro:before-swap')));
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(calls.navigate).not.toHaveBeenCalled();
    });
});
