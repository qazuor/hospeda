import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiChatFab } from '../../../src/components/accommodation/AiChatFab';

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) =>
            key === 'accommodations.aiChat.fabLabel'
                ? 'Ask AI'
                : key === 'accommodations.aiChat.dockLabel'
                  ? 'AI'
                  : (fallback ?? key)
    })
}));

describe('AiChatFab (HOS-2561)', () => {
    it('renders one decorative AI glyph and no badge (HOS-2607)', () => {
        render(
            <AiChatFab
                isOpen={false}
                onClick={() => undefined}
                locale="es"
                entityType="accommodation"
            />
        );

        const button = screen.getByRole('button', { name: 'Ask AI' });
        const icon = screen.getByTestId('ai-chat-fab-icon');
        expect(button).toContainElement(icon);
        expect(icon).toHaveAttribute('aria-hidden', 'true');
        expect(button).toContainElement(screen.getByText('AI'));
        expect(button.querySelectorAll('svg')).toHaveLength(1);
        expect(screen.queryByTestId('ai-chat-fab-badge')).toBeNull();
    });

    it('preserves the price above seven controls at a 360px dock width', () => {
        const fab = readFileSync('src/components/accommodation/AiChatFab.module.css', 'utf8');
        const bar = readFileSync(
            'src/components/listing/contact/ListingContactBar.client.tsx',
            'utf8'
        );
        const actions = readFileSync(
            'src/components/listing/contact/ListingActionBarButtons.module.css',
            'utf8'
        );
        const dock = readFileSync('src/components/shared/dock/MobileDock.astro', 'utf8');

        expect(bar).toMatch(/className=\{styles\.price\}[\s\S]*<ListingActionBarButtons/);
        expect(actions).toMatch(/\.row\s*\{[^}]*flex-wrap: nowrap;[^}]*gap: var\(--space-1\)/);
        expect(dock).toMatch(
            /\.mobile-dock__row\s*\{[^}]*gap: var\(--space-1\);\s*padding-inline: var\(--space-2\)/
        );
        const width = Number(
            fab.match(/\[data-mobile-dock\]\) \.fab\s*\{[^}]*width: (\d+)px/)?.[1]
        );
        expect(6 * 44 + 5 * 4 + 4 + width + 2 * 8).toBeLessThanOrEqual(360);
        expect(fab).toMatch(/\.dockLabel\s*\{\s*display: none;/);
        expect(fab).toMatch(/\[data-mobile-dock\]\) \.dockLabel\s*\{\s*display: block;/);
    });

    it('renders nothing while the panel is open', () => {
        const { container } = render(
            <AiChatFab
                isOpen
                onClick={() => undefined}
                locale="es"
                entityType="accommodation"
            />
        );
        expect(container).toBeEmptyDOMElement();
    });
});

import { readFileSync } from 'node:fs';
