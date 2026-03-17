import { describe, expect, it } from 'vitest';
import { createEmailClient } from '../src/client.js';

/**
 * Unit tests for createEmailClient factory function.
 */
describe('createEmailClient', () => {
    it('should return an instance with emails.send available', () => {
        // Arrange
        const apiKey = 'test-key';

        // Act
        const client = createEmailClient({ apiKey });

        // Assert
        expect(client).toBeDefined();
        expect(client.emails).toBeDefined();
        expect(typeof client.emails.send).toBe('function');
    });

    it('should create client with the provided API key', () => {
        // Arrange
        const apiKey = 're_test_abc123';

        // Act
        const client = createEmailClient({ apiKey });

        // Assert
        expect(client).toBeDefined();
        expect(client.emails).toBeDefined();
    });
});
