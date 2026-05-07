import { describe, expect, it, vi } from 'vitest';

vi.mock('@getbrevo/brevo', () => {
    class FakeApi {
        public apiKeys: Record<string, string> = {};
        setApiKey(key: string, value: string) {
            this.apiKeys[key] = value;
        }
    }
    return {
        TransactionalEmailsApi: FakeApi,
        TransactionalEmailsApiApiKeys: { apiKey: 'apiKey' }
    };
});

import { createEmailClient } from '../src/client.js';

/**
 * Unit tests for createEmailClient factory function.
 */
describe('createEmailClient', () => {
    it('should return a client whose setApiKey is configured', () => {
        // Arrange
        const apiKey = 'xkeysib-test-key';

        // Act
        const client = createEmailClient({ apiKey });

        // Assert
        expect(client).toBeDefined();
        // The fake api stores the key in `apiKeys.apiKey`. We assert via the
        // public surface so the test stays decoupled from Brevo internals.
        // biome-ignore lint/suspicious/noExplicitAny: test-only access to the fake's internal state
        expect((client as any).apiKeys.apiKey).toBe(apiKey);
    });

    it('should set the apiKey passed by the caller verbatim', () => {
        // Arrange
        const apiKey = 'xkeysib-another-test-value';

        // Act
        const client = createEmailClient({ apiKey });

        // Assert
        // biome-ignore lint/suspicious/noExplicitAny: test-only access to the fake's internal state
        expect((client as any).apiKeys.apiKey).toBe(apiKey);
    });
});
