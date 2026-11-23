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
    it('renders the chat bubble with a sparkle badge, both decorative', () => {
        render(
            <AiChatFab
                isOpen={false}
                onClick={() => undefined}
                locale="es"
                entityType="accommodation"
            />
        );

        const button = screen.getByRole('button', { name: 'Ask AI' });
        const sparkle = screen.getByTestId('ai-chat-fab-sparkle');
        const badge = screen.getByTestId('ai-chat-fab-badge');
        expect(button).toContainElement(badge);
        expect(badge).toContainElement(sparkle);
        expect(sparkle).toHaveAttribute('aria-hidden', 'true');
        expect(button.querySelectorAll('svg')).toHaveLength(2);
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
