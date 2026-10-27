/**
 * HOS-1641 (AC:V6:32) — the panel reads a listing's state from ONE column.
 *
 * Accommodations, gastronomies and experiences lost `lifecycleState`,
 * `visibility` and `moderationState`. Their lists filter on `status`, which the
 * API resolves to `publicationStatus`, and show one read-only state column.
 * These are pure data tests over the real configs and column factories.
 */

import type { TranslationKey } from '@repo/i18n';
import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { ColumnConfig } from '../../src/components/entity-list/types';
import { ColumnType } from '../../src/components/table/DataTable';
import { createAccommodationsColumns } from '../../src/features/accommodations/config/accommodations.columns';
import { accommodationsConfig } from '../../src/features/accommodations/config/accommodations.config';
import { meAccommodationsConfig } from '../../src/features/accommodations/config/me-accommodations.config';
import { createExperienceColumns } from '../../src/features/experience/config/experience.columns';
import {
    getPublicationStatusBadgeOptions,
    getPublicationStatusFilterOptions
} from '../../src/features/listing/config/publication-status-options';
import { createVenueColumns } from '../../src/features/venue/config/venue.columns';

const t = (key: TranslationKey): string => key;

const SIX_STATES = Object.values(PublicationStatusEnum);
const OLD_COLUMNS = ['lifecycleState', 'visibility', 'moderationState'] as const;

const EXPECTED_LABEL_KEYS: Readonly<Record<PublicationStatusEnum, string>> = {
    [PublicationStatusEnum.DRAFT]: 'admin-filters.publicationStatus.draft',
    [PublicationStatusEnum.PUBLISHED]: 'admin-filters.publicationStatus.published',
    [PublicationStatusEnum.UNPUBLISHED_BY_BILLING]:
        'admin-filters.publicationStatus.unpublishedByBilling',
    [PublicationStatusEnum.ARCHIVED]: 'admin-filters.publicationStatus.archived',
    [PublicationStatusEnum.MODERATED]: 'admin-filters.publicationStatus.moderated',
    [PublicationStatusEnum.PURGED]: 'admin-filters.publicationStatus.purged'
};

type StatusOption = { readonly value: string; readonly labelKey: string };

function statusOptions(config: typeof accommodationsConfig): ReadonlyArray<StatusOption> {
    const filter = config.filterBarConfig?.filters.find((f) => f.paramKey === 'status') as
        | { readonly type: string; readonly options: ReadonlyArray<StatusOption> }
        | undefined;
    if (!filter) throw new Error('status filter not found');
    expect(filter.type).toBe('select');
    return filter.options;
}

function stateColumns<T>(columns: readonly ColumnConfig<T>[]): readonly ColumnConfig<T>[] {
    return columns.filter(
        (c) =>
            c.id === 'publicationStatus' ||
            (OLD_COLUMNS as readonly string[]).includes(c.id) ||
            (OLD_COLUMNS as readonly string[]).includes(String(c.accessorKey))
    );
}

describe('the status filter of the accommodation lists', () => {
    for (const [name, config] of [
        ['admin list', accommodationsConfig],
        ['host portfolio', meAccommodationsConfig as typeof accommodationsConfig]
    ] as const) {
        it(`${name}: offers exactly the six publication states, no old lifecycle value`, () => {
            // Arrange / Act
            const options = statusOptions(config);

            // Assert
            expect(options.map((o) => o.value)).toEqual(SIX_STATES);
            expect(options.map((o) => o.value)).not.toContain('ACTIVE');
            for (const option of options) {
                expect(option.labelKey).toBe(
                    EXPECTED_LABEL_KEYS[option.value as PublicationStatusEnum]
                );
            }
        });

        it(`${name}: the peek drawer shows publicationStatus and none of the old columns`, () => {
            const keys = (config.peekFields ?? []).map((f) => f.accessorKey);
            expect(keys).toContain('publicationStatus');
            for (const old of OLD_COLUMNS) expect(keys).not.toContain(old);
        });
    }
});

describe('the state column of the three listing lists', () => {
    for (const [vertical, columns] of [
        ['accommodation', createAccommodationsColumns(t)],
        ['gastronomy', createVenueColumns(t)],
        ['experience', createExperienceColumns(t)]
    ] as const) {
        it(`${vertical}: ONE read-only publicationStatus badge with the six states`, () => {
            // Arrange / Act
            const state = stateColumns(columns as readonly ColumnConfig<unknown>[]);

            // Assert
            expect(state).toHaveLength(1);
            const [column] = state;
            expect(column?.id).toBe('publicationStatus');
            expect(column?.accessorKey).toBe('publicationStatus');
            expect(column?.columnType).toBe(ColumnType.BADGE);
            expect(column?.widgetRenderer).toBeUndefined();
            expect(column?.badgeOptions?.map((o) => o.value)).toEqual(SIX_STATES);
        });
    }
});

describe('publication-status-options', () => {
    it('labels each badge with its own key and a distinct color per state', () => {
        const badges = getPublicationStatusBadgeOptions({ t });
        expect(badges.map((b) => b.label)).toEqual(SIX_STATES.map((s) => EXPECTED_LABEL_KEYS[s]));
        expect(new Set(badges.map((b) => b.color)).size).toBe(SIX_STATES.length);
    });

    it('filter options and badges cover the same states in the same order', () => {
        expect(getPublicationStatusFilterOptions().map((o) => o.value)).toEqual(
            getPublicationStatusBadgeOptions({ t }).map((b) => b.value)
        );
    });
});
