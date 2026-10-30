import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const actionSource = readFileSync(
    new URL(
        '../../../admin/src/features/listing/config/listing-moderation-actions.ts',
        import.meta.url
    ),
    'utf8'
);
const verticalsSource = readFileSync(
    new URL(
        '../../../../packages/verticals/src/authorization/listing-operation.ts',
        import.meta.url
    ),
    'utf8'
);
function members(name: string, source: string): string[] {
    const match = source.match(new RegExp(`${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
    if (!match) throw new Error(`Could not find literal array ${name}`);
    return [...match[1]!.matchAll(/PublicationStatusEnum\.([A-Z_]+)/g)]
        .map((entry) => entry[1]!)
        .sort();
}
function ownerMembers(name: string): string[] {
    const match = verticalsSource.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]`));
    if (!match) throw new Error(`Could not find OWNER_ADMITTING_STATES.${name}`);
    return [...match[1]!.matchAll(/PublicationStatusEnum\.([A-Z_]+)/g)]
        .map((entry) => entry[1]!)
        .sort();
}

describe('TEST:1760:6b listing action parity', () => {
    it('keeps edit and purge action state lists in parity with API admission', () => {
        expect(members('LISTING_EDIT_STATES', actionSource)).toEqual(ownerMembers('EDIT'));
        expect(members('LISTING_PURGE_ON_REQUEST_STATES', actionSource)).toEqual(
            ownerMembers('DELETE')
        );
    });
});
