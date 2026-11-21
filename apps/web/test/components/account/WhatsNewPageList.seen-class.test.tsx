/**
 * @file WhatsNewPageList.seen-class.test.tsx
 * @description Regression test for HOS-2417: the card className template lacked a
 * space before the `--seen` modifier, producing `whats-new-cardwhats-new-card--seen`
 * and leaving already-seen entries unstyled.
 */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const items = [
    {
        id: 'seen-1',
        title: 'Seen entry',
        body: 'Body',
        publishedAt: '2026-01-01',
        seen: true,
        audience: 'all'
    },
    {
        id: 'new-1',
        title: 'New entry',
        body: 'Body',
        publishedAt: '2026-01-02',
        seen: false,
        audience: 'all'
    }
];

vi.mock('@/hooks/use-whats-new', () => ({
    useWhatsNew: () => ({ items, isLoading: false, markSeen: vi.fn() })
}));

import { WhatsNewPageList } from '../../../src/components/account/WhatsNewPageList.client';

describe('WhatsNewPageList card classes (HOS-2417)', () => {
    it('gives a seen card both the base and the --seen class as separate tokens', () => {
        const { container } = render(<WhatsNewPageList locale="es" />);

        const cards = container.querySelectorAll('article');
        const seen = cards[0] as HTMLElement;

        expect(seen.classList.contains('whats-new-card')).toBe(true);
        expect(seen.classList.contains('whats-new-card--seen')).toBe(true);
    });

    it('gives an unseen card only the base class', () => {
        const { container } = render(<WhatsNewPageList locale="es" />);

        const unseen = container.querySelectorAll('article')[1] as HTMLElement;

        expect(unseen.classList.contains('whats-new-card')).toBe(true);
        expect(unseen.classList.contains('whats-new-card--seen')).toBe(false);
    });
});
