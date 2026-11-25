import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiChatFab } from '../../../src/components/accommodation/AiChatFab';

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) =>
            key === 'accommodations.aiChat.fabLabel' ? 'Ask AI' : (fallback ?? key)
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
        expect(button.querySelectorAll('svg')).toHaveLength(1);
        expect(screen.queryByTestId('ai-chat-fab-badge')).toBeNull();
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
