import { describe, expect, it } from 'vitest';
import { getDeliveryUnavailableMessage } from '../../../src/routes/newsletter/admin/_singletons';

describe('getDeliveryUnavailableMessage', () => {
    it('identifies the missing email API key before the Redis queue', () => {
        expect(getDeliveryUnavailableMessage({ emailApiKeyConfigured: false })).toContain(
            'HOSPEDA_EMAIL_API_KEY missing'
        );
    });

    it('reports Redis when the email API key is configured', () => {
        expect(getDeliveryUnavailableMessage({ emailApiKeyConfigured: true })).toContain(
            'Redis not configured'
        );
    });
});
