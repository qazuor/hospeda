import { describe, expect, it } from 'vitest';
import {
    deterministicFixtureId,
    SEED_FIXTURE_NAMESPACE
} from '../../src/utils/deterministicFixtureId.js';

/** Canonical UUIDv5 shape: version nibble is `5`, variant nibble is `8|9|a|b`. */
const UUID_V5_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('deterministicFixtureId', () => {
    it('is a non-empty, syntactically valid namespace UUID', () => {
        expect(typeof SEED_FIXTURE_NAMESPACE).toBe('string');
        expect(SEED_FIXTURE_NAMESPACE).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        );
    });

    it('returns the same UUID for the same seedKey across repeated calls', () => {
        const first = deterministicFixtureId({ seedKey: 'accommodation:001-hotel-plaza' });
        const second = deterministicFixtureId({ seedKey: 'accommodation:001-hotel-plaza' });

        expect(first).toBe(second);
    });

    it('returns different UUIDs for different seedKeys', () => {
        const first = deterministicFixtureId({ seedKey: 'accommodation:001-hotel-plaza' });
        const second = deterministicFixtureId({ seedKey: 'accommodation:002-hotel-otro' });

        expect(first).not.toBe(second);
    });

    it('returns a canonical UUIDv5 string (version and variant nibbles set)', () => {
        const result = deterministicFixtureId({ seedKey: 'accommodation:001-hotel-plaza' });

        expect(result).toMatch(UUID_V5_PATTERN);
    });

    it('matches a pinned known-answer vector, guarding against silent algorithm drift', () => {
        // Computed once against SEED_FIXTURE_NAMESPACE and pinned here. If this
        // assertion ever fails after a refactor, the UUIDv5 algorithm (or the
        // namespace constant) changed and every example fixture id would shift.
        expect(deterministicFixtureId({ seedKey: 'accommodation:001-hotel-plaza' })).toBe(
            '100eab58-f576-553d-adc6-198e491fec14'
        );
        expect(deterministicFixtureId({ seedKey: 'accommodation:002-hotel-otro' })).toBe(
            '3360c04b-4afb-5505-9ccc-aae05558b9a1'
        );
    });

    it('throws a TypeError when seedKey is an empty string', () => {
        expect(() => deterministicFixtureId({ seedKey: '' })).toThrow(TypeError);
    });
});
