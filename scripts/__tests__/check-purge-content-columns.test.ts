/** TEST:4.3:4 — GUARD:G-FAC-10 fails closed on every column it cannot classify. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    analyze,
    type GuardInput,
    INVENTORY_PATH,
    type Inventory,
    MIN_COLUMNS,
    parseInventory,
    run,
    SUPPORT_EDIT_FIELDS_NAME
} from '../check-purge-content-columns';
import {
    camelToSnake,
    parseFunctionReturnColumns,
    parsePgTableColumns,
    parseSqlAssignments,
    parseStringArray,
    snakeToCamel
} from '../purge-content-columns-scan';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file: string) => readFileSync(path.join(REPO_ROOT, file), 'utf8');

const INVENTORY: Inventory = {
    systemColumns: {
        counts: { accommodations: 2, venues: 2, experiences: 2 },
        rows: [
            { key: 'accommodations.id', reason: 'identity' },
            { key: 'accommodations.business_lines', reason: 'classification' },
            { key: 'venues.id', reason: 'identity' },
            { key: 'venues.business_lines', reason: 'classification' },
            { key: 'experiences.id', reason: 'identity' },
            { key: 'experiences.business_lines', reason: 'classification' }
        ]
    },
    supportEditExceptions: { count: 0, fields: [] }
};

function baseInput(overrides: Partial<GuardInput> = {}): GuardInput {
    return {
        columns: {
            accommodation: ['id', 'summary', 'business_lines'],
            venue: ['id', 'summary', 'business_lines'],
            experience: ['id', 'summary', 'business_lines']
        },
        purgeSet: { accommodation: ['summary'], venue: ['summary'], experience: ['summary'] },
        supportEditFields: ['summary'],
        nonContentFields: ['businessLines'],
        inventory: INVENTORY,
        minColumns: { accommodation: 1, venue: 1, experience: 1 },
        minSetAssignments: { accommodation: 1, venue: 1, experience: 1 },
        ...overrides
    };
}

describe('TEST:4.3:4 GUARD:G-FAC-10 - the purge covers every content column', () => {
    it('positive control: the repository is green with the expected counts', () => {
        const result = run();
        expect(result.exitCode).toBe(0);
        expect(result.output).toMatch(/^OK GUARD:G-FAC-10: /);
        expect(result.output).toContain('accommodations 42 columns / 15 SET');
        expect(result.output).toContain('venues 46 columns / 24 SET');
        expect(result.output).toContain('experiences 46 columns / 24 SET');
        expect(result.output).toContain('71 system rows and 6 action-15 exceptions');
    });

    it('reads a column the table gains through a spread', () => {
        const helper = parseFunctionReturnColumns({
            file: 'listing-publication-columns.ts',
            source: read('packages/db/src/schemas/listing/listing-publication-columns.ts'),
            functionName: 'listingPublicationColumns'
        });
        expect(helper.error).toBeNull();
        expect(helper.columns).toEqual([
            'publication_status',
            'inactive_since',
            'deadlines_version',
            'deletion_announced_at'
        ]);
        const venue = parsePgTableColumns({
            file: 'venue.dbschema.ts',
            source: read('packages/db/src/schemas/venue/venue.dbschema.ts'),
            table: 'venues',
            resolveSpread: () => helper.columns
        });
        expect(venue.error).toBeNull();
        for (const column of helper.columns) expect(venue.columns).toContain(column);
        for (const column of [
            'entry_kind',
            'entry_note_i18n',
            'entry_price_from',
            'entry_price_updated_at',
            'min_age',
            'dress_code',
            'dress_code_note_i18n'
        ])
            expect(venue.columns).toContain(column);
    });

    it('reads the purge SET assignments of every vertical', () => {
        const scan = parseSqlAssignments({
            file: 'listing-purge.model.ts',
            source: read('packages/db/src/models/listing/listing-purge.model.ts'),
            variableName: 'BLANK_CONTENT'
        });
        expect(scan.error).toBeNull();
        expect(scan.assignments.venue).toHaveLength(24);
        expect(scan.assignments.venue).toContain('entry_note_i18n');
        expect(scan.assignments.venue).toContain('entry_price_updated_at');
        expect(scan.assignments.venue).toContain('dress_code_note_i18n');
        expect(scan.assignments.accommodation).toHaveLength(15);
        expect(scan.assignments.experience).toHaveLength(24);
    });

    it('converts between the purge snake_case and the action-15 camelCase', () => {
        expect(snakeToCamel('entry_note_i18n')).toBe('entryNoteI18n');
        expect(snakeToCamel('entry_price_updated_at')).toBe('entryPriceUpdatedAt');
        expect(snakeToCamel('dress_code_note_i18n')).toBe('dressCodeNoteI18n');
        expect(camelToSnake('entryNoteI18n')).toBe('entry_note_i18n');
        expect(camelToSnake('nameI18n')).toBe('name_i18n');
        expect(camelToSnake('isPriceOnRequest')).toBe('is_price_on_request');
    });

    it('rejects a new column that is neither in the SET nor classified', () => {
        const columns = {
            ...baseInput().columns,
            venue: ['id', 'summary', 'business_lines', 'mystery']
        };
        const violations = analyze(baseInput({ columns }));
        expect(violations).toContain(
            `venues.mystery is neither in the purge SET nor in the closed system list (${INVENTORY_PATH})`
        );
    });

    it('rejects a SET column missing from the action-15 list', () => {
        const violations = analyze(
            baseInput({
                columns: {
                    ...baseInput().columns,
                    venue: ['id', 'summary', 'business_lines', 'entry_note_i18n']
                },
                purgeSet: { ...baseInput().purgeSet, venue: ['summary', 'entry_note_i18n'] }
            })
        );
        expect(violations).toContain(
            `purge SET column entry_note_i18n maps to entryNoteI18n, which is missing from ${SUPPORT_EDIT_FIELDS_NAME}`
        );
    });

    it('rejects an action-15 field that is a column but not in the SET', () => {
        const violations = analyze(
            baseInput({
                columns: {
                    ...baseInput().columns,
                    venue: ['id', 'summary', 'business_lines', 'entry_note_i18n']
                },
                supportEditFields: ['summary', 'entryNoteI18n']
            })
        );
        expect(violations).toContain(
            'entryNoteI18n (column entry_note_i18n) is in LISTING_SUPPORT_EDIT_CONTENT_FIELDS but not in the purge SET'
        );
    });

    it('rejects a system row added without raising the table count', () => {
        const inventory: Inventory = {
            ...INVENTORY,
            systemColumns: {
                ...INVENTORY.systemColumns,
                rows: [
                    ...INVENTORY.systemColumns.rows,
                    { key: 'venues.extra', reason: 'classification' }
                ]
            }
        };
        const violations = analyze(
            baseInput({
                columns: {
                    ...baseInput().columns,
                    venue: ['id', 'summary', 'business_lines', 'extra']
                },
                inventory
            })
        );
        expect(violations).toContain(
            'venues system count is 2 but the list has 3 rows; update the count with every row'
        );
    });

    it('rejects the system list when business_lines is not in LISTING_NON_CONTENT_FIELDS', () => {
        const violations = analyze(baseInput({ nonContentFields: ['publicationStatus'] }));
        expect(violations).toContain(
            'businessLines must be in LISTING_NON_CONTENT_FIELDS (DEC-FAC-074: classification, not content)'
        );
    });

    it('rejects a scan below the column floor', () => {
        const violations = analyze(baseInput({ minColumns: { ...MIN_COLUMNS, venue: 99 } }));
        expect(violations).toContain('venues read only 3 columns; the floor is 99');
    });

    it('rejects an inventory with a duplicated row or a missing reason', () => {
        const row = { key: 'venues.id', reason: 'identity' };
        const duplicated = parseInventory(
            JSON.stringify({
                systemColumns: {
                    counts: { accommodations: 0, venues: 2, experiences: 0 },
                    rows: [row, row]
                },
                supportEditExceptions: { count: 0, fields: [] }
            })
        );
        expect(duplicated.error).toContain('repeats system row venues.id');
        const noReason = parseInventory(
            JSON.stringify({
                systemColumns: {
                    counts: { accommodations: 0, venues: 1, experiences: 0 },
                    rows: [{ key: 'venues.id' }]
                },
                supportEditExceptions: { count: 0, fields: [] }
            })
        );
        expect(noReason.error).toContain('needs a key and a reason');
    });

    it('is wired into check:guards and the guards CI job with its own step', () => {
        const scripts = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'))
            .scripts as Record<string, string>;
        expect(scripts['check:purge-content-columns']).toBe(
            'tsx scripts/check-purge-content-columns.ts'
        );
        expect(scripts['check:guards']).toContain('pnpm check:purge-content-columns');
        const ci = read('.github/workflows/ci.yml');
        const guardsJob = ci.split('\n  guards:\n')[1]?.split(/\n {2}[a-zA-Z][\w-]*:\n/)[0];
        expect(guardsJob).toBeDefined();
        expect(guardsJob).toContain(
            'name: Check the purge covers every content column of a listing (GUARD:G-FAC-10)'
        );
        expect(guardsJob).toContain('run: pnpm check:purge-content-columns');
    });

    it('reads the action-15 list and the non-content list from their sources', () => {
        const support = parseStringArray({
            file: 'listing-support-edit.ts',
            source: read('packages/service-core/src/services/listing/listing-support-edit.ts'),
            variableName: 'LISTING_SUPPORT_EDIT_CONTENT_FIELDS'
        });
        expect(support.error).toBeNull();
        expect(support.values).toContain('entryNoteI18n');
        expect(support.values).toContain('entryPriceUpdatedAt');
        const nonContent = parseStringArray({
            file: 'listing-owner-act.ts',
            source: read('packages/service-core/src/services/listing/listing-owner-act.ts'),
            variableName: 'LISTING_NON_CONTENT_FIELDS'
        });
        expect(nonContent.error).toBeNull();
        expect(nonContent.values).toContain('businessLines');
    });
});
