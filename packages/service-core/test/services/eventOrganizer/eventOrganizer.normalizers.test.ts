import { describe, expect, it } from 'vitest';
import {
    normalizeCreateInput,
    normalizeUpdateInput
} from '../../../src/services/eventOrganizer/eventOrganizer.normalizers';
import { createActor } from '../../factories/actorFactory';
import { createMockEventOrganizer } from '../../factories/eventOrganizerFactory';

const baseInput = createMockEventOrganizer({
    name: ' Test Org ',
    logo: ' https://logo.com/logo.png '
});
const actor = createActor();

describe('eventOrganizer normalizers', () => {
    it('normalizeCreateInput trims all string fields', () => {
        const result = normalizeCreateInput(baseInput, actor);
        expect(result.name).toBe('Test Org');
        expect(result.logo).toBe('https://logo.com/logo.png');
    });

    it('normalizeUpdateInput trims only present fields', () => {
        const partial = { name: ' Test Org ', logo: ' https://logo.com/logo.png ' };
        const result = normalizeUpdateInput(partial, actor);
        expect(result.name).toBe('Test Org');
        expect(result.logo).toBe('https://logo.com/logo.png');
    });

    it('normalizeCreateInput handles adminInfo undefined', () => {
        const input = { ...baseInput, adminInfo: undefined };
        const result = normalizeCreateInput(input, actor);
        expect(result.adminInfo).toBeUndefined();
    });

    it('normalizeCreateInput ignores unexpected fields', () => {
        const input = { ...baseInput, unexpectedField: 'foo' } as typeof baseInput & {
            unexpectedField: string;
        };
        const result = normalizeCreateInput(input, actor);
        expect(
            (result as typeof baseInput & { unexpectedField?: string }).unexpectedField
        ).toBeUndefined();
    });

    it('normalizeUpdateInput handles adminInfo undefined', () => {
        const partial = { adminInfo: undefined };
        const result = normalizeUpdateInput(partial, actor);
        expect(result.adminInfo).toBeUndefined();
    });

    it('normalizeUpdateInput ignores unexpected fields', () => {
        const partial = { name: 'Test Org', unexpectedField: 'foo' } as { name: string } & {
            unexpectedField: string;
        };
        const result = normalizeUpdateInput(partial, actor);
        expect(
            (result as { name: string } & { unexpectedField?: string }).unexpectedField
        ).toBeUndefined();
    });

    it('normalizeUpdateInput does not mutate non-string fields', () => {
        const partial = { socialNetworks: { facebook: 'fb' } };
        const result = normalizeUpdateInput(partial, actor);
        expect(result.socialNetworks).toEqual({ facebook: 'fb' });
    });

    it('normalizeUpdateInput handles all optional fields as undefined', () => {
        const partial = { name: undefined, logo: undefined };
        const result = normalizeUpdateInput(partial, actor);
        expect(result.name).toBeUndefined();
        expect(result.logo).toBeUndefined();
    });
});
