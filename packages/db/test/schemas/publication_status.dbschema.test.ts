/**
 * TEST:V6:17 (AC:V6:16, HOS-1478 — V6.8a), in-process half: the Drizzle
 * `publication_status_enum` carries exactly the six listing states of `V/03` §9
 * that `PublicationStatusEnum` declares, and the three listing tables share the
 * same publication-model columns. The from-scratch database half lives in
 * `test/integration/listing-publication-model-from-empty.test.ts`.
 */
import { PublicationStatusEnum, PublicationStatusEnumSchema } from '@repo/schemas';
import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { accommodations } from '../../src/schemas/accommodation/accommodation.dbschema.ts';
import { experiences } from '../../src/schemas/experience/experiences.dbschema.ts';
import { gastronomies } from '../../src/schemas/gastronomy/gastronomy.dbschema.ts';
import { PublicationStatusPgEnum } from '../../src/schemas/listing/publication_status.dbschema.ts';

describe('PublicationStatusPgEnum (TEST:V6:17)', () => {
    it('has SQL enum name publication_status_enum', () => {
        expect(PublicationStatusPgEnum.enumName).toBe('publication_status_enum');
    });

    it('carries the six states of V/03 §9, same values and order as the TS enum', () => {
        expect(PublicationStatusPgEnum.enumValues).toEqual(Object.values(PublicationStatusEnum));
        expect(PublicationStatusPgEnum.enumValues).toEqual([
            'DRAFT',
            'PUBLISHED',
            'UNPUBLISHED_BY_BILLING',
            'ARCHIVED',
            'MODERATED',
            'PURGED'
        ]);
    });

    it('is validated by its Zod schema', () => {
        expect(PublicationStatusEnumSchema.safeParse('MODERATED').success).toBe(true);
        expect(PublicationStatusEnumSchema.safeParse('ACTIVE').success).toBe(false);
    });
});

describe.each([
    ['accommodations', accommodations],
    ['gastronomies', gastronomies],
    ['experiences', experiences]
] as const)('listing table %s (TEST:V6:17)', (_name, table) => {
    it('declares the publication-model columns with V6.9 nullability', () => {
        const columns = getTableColumns(table);
        expect(columns.publicationStatus.name).toBe('publication_status');
        expect(columns.inactiveSince.name).toBe('inactive_since');
        expect(columns.deadlinesVersion.name).toBe('deadlines_version');
        expect(columns.deletionAnnouncedAt.name).toBe('deletion_announced_at');
        for (const column of [
            columns.publicationStatus,
            columns.inactiveSince,
            columns.deadlinesVersion
        ]) {
            expect(column.notNull).toBe(true);
            expect(column.hasDefault).toBe(false);
        }
        expect(columns.deletionAnnouncedAt.notNull).toBe(false);
        expect(columns.deletionAnnouncedAt.hasDefault).toBe(false);
    });
});
