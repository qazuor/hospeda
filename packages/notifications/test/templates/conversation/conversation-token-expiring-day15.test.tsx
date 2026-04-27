/**
 * ConversationTokenExpiringDay15 Email Template Tests
 *
 * @module test/templates/conversation/conversation-token-expiring-day15.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    ConversationTokenExpiringDay15,
    type ConversationTokenExpiringDay15Props
} from '../../../src/templates/conversation/conversation-token-expiring-day15';

describe('ConversationTokenExpiringDay15', () => {
    const validProps: ConversationTokenExpiringDay15Props = {
        accommodationName: 'Posada del Río Uruguay',
        renewUrl: 'https://hospeda.com.ar/guest/renew?token=day15-token',
        expiryDate: '10 de mayo de 2026',
        locale: 'es'
    };

    it('should render without errors', () => {
        // Arrange & Act
        const render = () => renderToStaticMarkup(ConversationTokenExpiringDay15(validProps));

        // Assert
        expect(render).not.toThrow();
    });

    it('should include the renewal URL', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationTokenExpiringDay15(validProps));

        // Assert
        expect(html).toContain('https://hospeda.com.ar/guest/renew?token=day15-token');
    });

    it('should include the accommodation name', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationTokenExpiringDay15(validProps));

        // Assert
        expect(html).toContain('Posada del Río Uruguay');
    });

    it('should include the expiry date', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationTokenExpiringDay15(validProps));

        // Assert
        expect(html).toContain('10 de mayo de 2026');
    });

    it('should mention 15 days in the copy', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationTokenExpiringDay15(validProps));

        // Assert
        expect(html).toContain('15');
    });

    it('should include the account-creation suggestion', () => {
        // Arrange & Act
        const html = renderToStaticMarkup(ConversationTokenExpiringDay15(validProps));

        // Assert
        expect(html).toContain('cuenta gratuita');
    });
});
