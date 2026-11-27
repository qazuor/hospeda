/**
 * Integration test: `translation_meta` on venues and experiences (HOS-2658, spec §8.1).
 *
 * After the versioned migrations run, both tables carry a nullable jsonb
 * `translation_meta` column whose default is the empty object, exactly like
 * `accommodations.translation_meta`. The default is asserted through the
 * catalog AND by evaluating it, so a generated SQL drift (wrong type, missing
 * default) turns this red.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);

describe('translation_meta column on venues and experiences (HOS-2658)', () => {
    it('exists as a nullable jsonb column defaulting to {} on both tables', async () => {
        // Arrange / Act
        const columns = await getTestPool().query<{
            table_name: string;
            data_type: string;
            is_nullable: string;
            column_default: string | null;
        }>(
            `SELECT table_name, data_type, is_nullable, column_default
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND column_name = 'translation_meta'
               AND table_name IN ('venues', 'experiences')
             ORDER BY table_name`
        );

        // Assert
        expect(columns.rows).toEqual([
            {
                table_name: 'experiences',
                data_type: 'jsonb',
                is_nullable: 'YES',
                column_default: "'{}'::jsonb"
            },
            {
                table_name: 'venues',
                data_type: 'jsonb',
                is_nullable: 'YES',
                column_default: "'{}'::jsonb"
            }
        ]);
    });

    it('evaluates the column default to an empty object', async () => {
        // Arrange
        const pool = getTestPool();
        const defaults = await pool.query<{ table_name: string; column_default: string }>(
            `SELECT table_name, column_default FROM information_schema.columns
             WHERE table_schema = 'public' AND column_name = 'translation_meta'
               AND table_name IN ('venues', 'experiences')
             ORDER BY table_name`
        );

        // Act
        const evaluated = await Promise.all(
            defaults.rows.map(async (row) => {
                const result = await pool.query<{ value: unknown }>(
                    `SELECT (${row.column_default}) AS value`
                );
                return { table: row.table_name, value: result.rows[0]?.value };
            })
        );

        // Assert
        expect(evaluated).toEqual([
            { table: 'experiences', value: {} },
            { table: 'venues', value: {} }
        ]);
    });
});
