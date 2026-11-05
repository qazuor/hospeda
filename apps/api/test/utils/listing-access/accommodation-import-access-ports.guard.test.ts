import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const portsSource = readFileSync(
    fileURLToPath(
        new URL(
            '../../../src/utils/listing-access/accommodation-import-access-ports.ts',
            import.meta.url
        )
    ),
    'utf8'
);

describe('accommodation import access reader wiring', () => {
    it('uses the canonical trial reader and the subscription model history reader', () => {
        expect(portsSource).toContain('buildTrialStartReader');
        expect(portsSource).toContain('reader.findTrialOfUser');
        expect(portsSource).toContain('subscriptionModel.existsAnyForUser');
        expect(portsSource).not.toContain('from(subscriptions)');
        expect(portsSource).toContain('AI_ENTITLEMENT_KEY_BY_FEATURE.accommodation_import');
    });
});
