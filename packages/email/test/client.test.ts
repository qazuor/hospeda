import { describe, expect, it } from 'vitest';
import { createEmailClient } from '../src/client.js';

/**
 * Unit tests for createEmailClient factory function.
 */
describe('createEmailClient', () => {
    it('should set the apiKey passed by the caller verbatim', () => {
        // Arrange
        const apiKey = 'xkeysib-test-key';

        // Act
        const client = createEmailClient({ apiKey });

        // Assert
        expect(client.apiKey).toBe(apiKey);
    });

    it('should use the default Brevo base URL when none is provided', () => {
        // Arrange
        const apiKey = 'xkeysib-test-key';

        // Act
        const client = createEmailClient({ apiKey });

        // Assert
        expect(client.baseUrl).toBe('https://api.brevo.com/v3');
    });

    it('should accept a baseUrl override (used by tests)', () => {
        // Arrange
        const apiKey = 'xkeysib-test-key';

        // Act
        const client = createEmailClient({ apiKey, baseUrl: 'https://test.example/v3' });

        // Assert
        expect(client.baseUrl).toBe('https://test.example/v3');
    });
});
