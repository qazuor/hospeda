/**
 * ConversationTokenExpiringDay25 Email Template Tests
 *
 * @module test/templates/conversation/conversation-token-expiring-day25.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConversationTokenExpiringDay15 } from '../../../src/templates/conversation/conversation-token-expiring-day15';
import {
    ConversationTokenExpiringDay25,
    type ConversationTokenExpiringDay25Props
} from '../../../src/templates/conversation/conversation-token-expiring-day25';

describe('ConversationTokenExpiringDay25', () => {
    const validProps: ConversationTokenExpiringDay25Props = {
        accommodationName: 'Estancia La Armonía',
        renewUrl: 'https://hospeda.com.ar/guest/renew?token=day25-token',
        expiryDate: '25 de abril de 2026',
        locale: 'es'
    };

    it('should render without errors', () => {
        // Arrange & Act
        const render = () => renderToStaticMarkup(ConversationTokenExpiringDay25(validProps));

        // Assert
        expect(render).not.toThrow();
    });

    it('should include the renewal URL', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationTokenExpiringDay25(validProps));

        // Assert
        expect(html).toContain('https://hospeda.com.ar/guest/renew?token=day25-token');
    });

    it('should include the accommodation name', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationTokenExpiringDay25(validProps));

        // Assert
        expect(html).toContain('Estancia La Armonía');
    });

    it('should include the expiry date', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationTokenExpiringDay25(validProps));

        // Assert
        expect(html).toContain('25 de abril de 2026');
    });

    it('should contain urgency copy that distinguishes it from the day-15 template', () => {
        // Arrange
        const sharedProps = {
            accommodationName: 'Hotel Test',
            renewUrl: 'https://hospeda.com.ar/renew',
            expiryDate: '1 de junio de 2026',
            locale: 'es' as const
        };

        // Act
        const day25Html = renderToStaticMarkup(ConversationTokenExpiringDay25(sharedProps));
        const day15Html = renderToStaticMarkup(ConversationTokenExpiringDay15(sharedProps));

        // Assert — day25 must contain the "últimos 5 días" urgency marker absent in day15
        expect(day25Html).toContain('últimos 5 días');
        expect(day15Html).not.toContain('últimos 5 días');
    });

    it('should mention 5 days in the copy', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationTokenExpiringDay25(validProps));

        // Assert
        expect(html).toContain('5');
    });
});
