/**
 * HOS-2034: the full storage chain for the editors' flat phone fields.
 *
 * Editors compose `"+54 <typed>"` (see `composePhoneValue` in apps/web), the
 * HTTP schema maps the flat `phone`/`whatsapp` to `contactInfo.mobilePhone` /
 * `contactInfo.whatsapp`, and the service normalizer stores them as mobile
 * numbers (`+549...`). Landline canonical (`+54...`) applies to
 * `homePhone`/`workPhone` only, which the editors do not write.
 */
import {
    AccommodationUpdateHttpSchema,
    ContactInfoSchema,
    httpToDomainAccommodationUpdate
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { normalizeContactInfo } from '../../src/utils/normalizer';

describe('editor composed phone -> HTTP schema -> normalizer -> stored contactInfo', () => {
    it.each([
        ['3442 45-2345', '+5493442452345'],
        ['3442452345', '+5493442452345'],
        ['(3442) 45-2345', '+5493442452345'],
        ['03442 452345', '+5493442452345'],
        ['3442 15 45-2345', '+5493442452345'],
        ['+54 9 3442 45-2345', '+5493442452345'],
        ['+5493442452345', '+5493442452345'],
        ['54 3442 452345', '+5493442452345'],
        ['0223-155-1234', '+5492231551234'],
        ['0 3442 452345', '+5493442452345']
    ])('%s is stored as %s in mobilePhone and whatsapp', (typed, stored) => {
        // Same string composePhoneValue yields for the default Argentina selector.
        const composed = typed.startsWith('+')
            ? typed
            : /^54[\s\d()-]/.test(typed)
              ? `+${typed}`
              : `+54 ${typed}`;

        const http = AccommodationUpdateHttpSchema.parse({ phone: composed, whatsapp: composed });
        const mapped = httpToDomainAccommodationUpdate(http).contactInfo;
        const saved = normalizeContactInfo(mapped) as Record<string, string>;

        expect(saved.mobilePhone).toBe(stored);
        expect(saved.whatsapp).toBe(stored);
        expect(ContactInfoSchema.safeParse(saved).success).toBe(true);
    });

    it('drops the trunk 0 of a stored plus-54 value, idempotently', () => {
        const http = AccommodationUpdateHttpSchema.parse({ phone: '+54 0223-155-1234' });
        const saved = normalizeContactInfo(
            httpToDomainAccommodationUpdate(http).contactInfo
        ) as Record<string, string>;
        expect(saved.mobilePhone).toBe('+5492231551234');
        expect((normalizeContactInfo(saved) as Record<string, string>).mobilePhone).toBe(
            saved.mobilePhone
        );
    });
});
