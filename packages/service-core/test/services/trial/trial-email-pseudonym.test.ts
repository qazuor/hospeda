/**
 * TEST:V4:3 (HOS-1443, V4.1, AC:V4:2): the pseudonym of the normalised mailbox.
 *
 * The expected hashes below were computed OUTSIDE the code under test with
 * `printf '<mailbox>' | sha256sum`, so a change to the hash function or to the
 * normalisation fails here instead of silently handing trials back.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    computeTrialEmailPseudonym,
    MEASURED_RULES,
    normalizeEmailForTrial
} from '../../../src/services/trial';

const pseudonymOf = (email: string): string => {
    const result = computeTrialEmailPseudonym({ email });
    if (!result.ok) {
        throw new Error(`unexpected invalid mailbox: ${email}`);
    }
    return result.pseudonym;
};

const normalizedOf = (email: string): string => {
    const result = normalizeEmailForTrial({ email });
    if (!result.ok) {
        throw new Error(`unexpected invalid mailbox: ${email}`);
    }
    return result.normalized;
};

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('TEST:V4:3 - the five pairs of the criterion', () => {
    it('shares the pseudonym of ana.maria@gmail.com and anamaria@gmail.com', () => {
        expect(pseudonymOf('ana.maria@gmail.com')).toBe(pseudonymOf('anamaria@gmail.com'));
    });

    it('does not share the pseudonym of ana.maria@hotel.com and anamaria@hotel.com', () => {
        expect(pseudonymOf('ana.maria@hotel.com')).not.toBe(pseudonymOf('anamaria@hotel.com'));
    });

    it('does not share the pseudonym of ana.maria@hotmail.com and anamaria@hotmail.com', () => {
        expect(pseudonymOf('ana.maria@hotmail.com')).not.toBe(pseudonymOf('anamaria@hotmail.com'));
    });

    it('does not unify Microsoft domains: ana@hotmail.com and ana@outlook.com differ', () => {
        expect(pseudonymOf('ana@hotmail.com')).not.toBe(pseudonymOf('ana@outlook.com'));
    });

    it('shares the pseudonym of ana+1@hotel.com and ana+2@hotel.com (own domain loses the +alias)', () => {
        expect(pseudonymOf('ana+1@hotel.com')).toBe(pseudonymOf('ana+2@hotel.com'));
    });
});

describe('TEST:V4:3 - the function is unkeyed SHA-256 and does not move', () => {
    it('matches an independent sha256sum of the normalised mailbox', () => {
        expect(pseudonymOf('anamaria@gmail.com')).toBe(
            '3e98a21feae29c846262434874fef5336cdee99694be928cd19ad955077faa99'
        );
        expect(pseudonymOf('ana@hotel.com')).toBe(
            'a0c80f559e0c3ebc8b2a75ec86321f4e633c6932a0ba753c65efc4efd7b68c69'
        );
    });

    it('is 64 lowercase hex characters', () => {
        expect(pseudonymOf('Ana.Maria@Gmail.com')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('gives the same pseudonym on every call and for any letter case', () => {
        expect(pseudonymOf('ana@hotel.com')).toBe(pseudonymOf('ana@hotel.com'));
        expect(pseudonymOf('ANA@Hotel.COM')).toBe(pseudonymOf('ana@hotel.com'));
    });

    it('does not depend on any secret of the environment', () => {
        const before = pseudonymOf('ana@hotel.com');
        vi.stubEnv('HOSPEDA_BETTER_AUTH_SECRET', 'a-different-secret-for-this-test-only');
        expect(pseudonymOf('ana@hotel.com')).toBe(before);
    });
});

describe('TEST:V4:3 - without the step-0 measurement the "a medir" rules do not apply', () => {
    it('keeps every measured rule off', () => {
        expect(Object.values(MEASURED_RULES)).toEqual([false, false, false, false]);
    });

    it('does not share the pseudonym of ana+1@yahoo.com and ana+2@yahoo.com', () => {
        expect(pseudonymOf('ana+1@yahoo.com')).not.toBe(pseudonymOf('ana+2@yahoo.com'));
    });

    it('does not share the pseudonym of two + aliases of aol.com', () => {
        expect(pseudonymOf('ana+1@aol.com')).not.toBe(pseudonymOf('ana+2@aol.com'));
    });

    it('keeps the + alias of the other named "as is" providers', () => {
        for (const domain of ['zoho.com', 'gmx.com', 'fibertel.com.ar', 'ferozo.com']) {
            expect(pseudonymOf(`ana+1@${domain}`)).not.toBe(pseudonymOf(`ana+2@${domain}`));
        }
    });

    it('does not unify googlemail.com with gmail.com, nor the iCloud domains', () => {
        expect(pseudonymOf('ana@googlemail.com')).not.toBe(pseudonymOf('ana@gmail.com'));
        expect(pseudonymOf('ana@me.com')).not.toBe(pseudonymOf('ana@icloud.com'));
    });

    it('keeps the dots of Proton and iCloud', () => {
        expect(pseudonymOf('ana.maria@proton.me')).not.toBe(pseudonymOf('anamaria@proton.me'));
        expect(pseudonymOf('ana.maria@icloud.com')).not.toBe(pseudonymOf('anamaria@icloud.com'));
    });
});

describe('TEST:V4:3 - the closed provider list', () => {
    it.each([
        ['Ana.Maria+promo@Gmail.com', 'anamaria@gmail.com'],
        ['ana.maria+x@googlemail.com', 'anamaria@googlemail.com'],
        ['ana.maria+x@hotmail.com', 'ana.maria@hotmail.com'],
        ['ana.maria+x@outlook.com.ar', 'ana.maria@outlook.com.ar'],
        ['ana.maria+x@pm.me', 'ana.maria@proton.me'],
        ['ana.maria+x@protonmail.com', 'ana.maria@proton.me'],
        ['ana.maria+x@mac.com', 'ana.maria@mac.com'],
        ['ana.maria+x@fastmail.com', 'ana.maria@fastmail.com'],
        ['ana.maria+x@yandex.com', 'ana.maria@yandex.com'],
        ['ana.maria+x@yahoo.com.ar', 'ana.maria+x@yahoo.com.ar'],
        ['ana.maria+x@hotel.com', 'ana.maria@hotel.com']
    ])('normalises %s to %s', (input, expected) => {
        expect(normalizedOf(input)).toBe(expected);
    });

    it('does not unify the Microsoft country variants', () => {
        expect(pseudonymOf('ana@hotmail.com')).not.toBe(pseudonymOf('ana@hotmail.com.ar'));
        expect(pseudonymOf('ana@live.com')).not.toBe(pseudonymOf('ana@msn.com'));
    });

    it('leaves a local part that would end up empty as it was', () => {
        expect(normalizedOf('+a@hotel.com')).toBe('+a@hotel.com');
        expect(pseudonymOf('+a@hotel.com')).not.toBe(pseudonymOf('+b@hotel.com'));
    });
});

describe('TEST:V4:3 - invalid mailboxes', () => {
    it.each([
        '',
        'no-at-sign',
        '@hotel.com',
        'ana@',
        'a na@hotel.com'
    ])('answers INVALID_EMAIL for %j', (email) => {
        const result = computeTrialEmailPseudonym({ email });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_EMAIL');
        }
    });
});
