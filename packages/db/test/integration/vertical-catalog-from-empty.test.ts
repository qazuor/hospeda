// TEST:V1:1 and TEST:V1:3 — the full migration chain on an empty disposable database.
import {
    CATALOG_KEY_DEFINITIONS,
    VERTICAL_ACTIVATION_EVENT_BY_VERTICAL,
    VerticalEnum
} from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

/** Runs one statement inside a transaction that is always rolled back; returns its error, if any. */
async function rejectedBy(sqlText: string): Promise<{ code?: string; constraint?: string } | null> {
    const client = await getTestPool().connect();
    try {
        await client.query('BEGIN');
        await client.query(sqlText);
        return null;
    } catch (error) {
        return error as { code?: string; constraint?: string };
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
}

describe('TEST:V1:1 — vertical table after db:migrate from empty', () => {
    it('has one row per VerticalEnum value, with the activation event of DEC-TRIAL-006', async () => {
        const { rows } = await getTestPool().query<{ id: string; activation_event: string | null }>(
            'SELECT id, activation_event FROM vertical ORDER BY id'
        );

        const expected = Object.values(VerticalEnum)
            .map((id) => ({ id, activation_event: VERTICAL_ACTIVATION_EVENT_BY_VERTICAL[id] }))
            .sort((a, b) => a.id.localeCompare(b.id));
        expect(rows).toEqual(expected);
    });

    it('declares listing_published for the three listing verticals, the Empezar button for tourist and NULL for partner', async () => {
        const { rows } = await getTestPool().query<{ id: string; activation_event: string | null }>(
            'SELECT id, activation_event FROM vertical'
        );
        const byId = Object.fromEntries(rows.map((r) => [r.id, r.activation_event]));

        expect(byId).toEqual({
            accommodation: 'listing_published',
            gastronomy: 'listing_published',
            experience: 'listing_published',
            tourist: 'start_button_pressed',
            partner: null
        });
    });

    it('rejects an activation event outside the closed catalog', async () => {
        const error = await rejectedBy(
            "UPDATE vertical SET activation_event = 'user_signed_up' WHERE id = 'partner'"
        );

        expect(error?.code).toBe('23514');
        expect(error?.constraint).toBe('ck_vertical_activation_event');
    });

    it('rejects a vertical the enum does not know', async () => {
        const error = await rejectedBy(
            "INSERT INTO vertical (id, activation_event) VALUES ('addon', NULL)"
        );

        expect(error?.code).toBe('23514');
        expect(error?.constraint).toBe('ck_vertical_id');
    });
});

describe('TEST:V1:3 — catalog_key table after db:migrate from empty', () => {
    it('holds exactly the catalog keys, each with its four attributes and its class', async () => {
        const { rows } = await getTestPool().query<{
            key: string;
            kind: string;
            scope: string;
            aggregation_strategy: string;
            enforcement_strategy: string;
            key_class: string;
        }>('SELECT * FROM catalog_key ORDER BY key');

        const expected = CATALOG_KEY_DEFINITIONS.map((d) => ({
            key: d.key,
            kind: d.kind,
            scope: d.scope,
            aggregation_strategy: d.aggregationStrategy,
            enforcement_strategy: d.enforcementStrategy,
            key_class: d.keyClass
        })).sort((a, b) => (a.key < b.key ? -1 : 1));
        expect(rows).toEqual(expected);
    });

    it('contains the carousel presence key, COMMERCIAL', async () => {
        const { rows } = await getTestPool().query<{ key_class: string; scope: string }>(
            "SELECT key_class, scope FROM catalog_key WHERE key = 'partner_carousel_presence'"
        );

        expect(rows).toEqual([{ key_class: 'COMMERCIAL', scope: 'vertical' }]);
    });

    it('classifies the two floor keys as BASE and nothing else as BASE', async () => {
        const { rows } = await getTestPool().query<{ key: string }>(
            "SELECT key FROM catalog_key WHERE key_class = 'BASE' ORDER BY key"
        );

        expect(rows.map((r) => r.key)).toEqual(['recover_own_listing', 'subscribe_to_plan']);
    });

    it.each([
        ['kind', "'switch'", 'ck_catalog_key_kind'],
        ['scope', "'tenant'", 'ck_catalog_key_scope'],
        ['aggregation_strategy', "'AVERAGE'", 'ck_catalog_key_aggregation_strategy'],
        ['enforcement_strategy', "'DELETE'", 'ck_catalog_key_enforcement_strategy'],
        ['key_class', "'GRATIS'", 'ck_catalog_key_class']
    ])('rejects an out-of-list %s', async (column, value, constraint) => {
        const error = await rejectedBy(
            `UPDATE catalog_key SET ${column} = ${value} WHERE key = 'max_accommodations'`
        );

        expect(error?.code).toBe('23514');
        expect(error?.constraint).toBe(constraint);
    });
});
