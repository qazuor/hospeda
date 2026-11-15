/**
 * HOS-2042: the editors' flat `landlinePhone` is stored in `contactInfo.workPhone`
 * with the LANDLINE canonical form (`+54` + 10 national digits), never as a
 * mobile (`+549...`), and the main phone keeps its mobile canonical form.
 */
import {
    AccommodationUpdateHttpSchema,
    ContactInfoSchema,
    httpToDomainAccommodationUpdate
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { normalizeContactInfo } from '../../src/utils/normalizer';

describe('editor landline -> HTTP schema -> normalizer -> stored workPhone', () => {
    it.each([
        ['+54 3442 45-2345', '+543442452345'],
        ['+54 03442 452345', '+543442452345'],
        ['+54 (3442) 45-2345', '+543442452345'],
        ['+543442452345', '+543442452345']
    ])('%s is stored as %s', (typed, stored) => {
        const http = AccommodationUpdateHttpSchema.parse({ landlinePhone: typed });
        const mapped = httpToDomainAccommodationUpdate(http).contactInfo;
        const saved = normalizeContactInfo(mapped) as Record<string, string>;

        expect(saved.workPhone).toBe(stored);
        expect(saved).not.toHaveProperty('mobilePhone');
        expect(ContactInfoSchema.safeParse(saved).success).toBe(true);
    });

    it('stores the same digits in both fields with different canonical forms', () => {
        const http = AccommodationUpdateHttpSchema.parse({
            phone: '+54 3442 45-2345',
            landlinePhone: '+54 3442 45-2345'
        });
        const saved = normalizeContactInfo(
            httpToDomainAccommodationUpdate(http).contactInfo
        ) as Record<string, string>;

        expect(saved.mobilePhone).toBe('+5493442452345');
        expect(saved.workPhone).toBe('+543442452345');
    });

    it('never writes homePhone', () => {
        const http = AccommodationUpdateHttpSchema.parse({ landlinePhone: '+54 3442 45-2345' });
        const saved = normalizeContactInfo(
            httpToDomainAccommodationUpdate(http).contactInfo
        ) as Record<string, string>;

        expect(saved).not.toHaveProperty('homePhone');
    });
});
