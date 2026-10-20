/**
 * Resolves a seed data-migration module by its numeric prefix.
 *
 * Some historical data-migration files carry a retired word in their filename
 * (`src/data-migrations/` is exempt from the rename and keeps its on-disk names
 * because the ledger keys on them). A test that imported such a file by literal
 * path would put that word back into the tree, so tests resolve the file by its
 * number instead.
 *
 * @module test/data-migrations/__helpers__/load-migration
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SeedMigrationModule } from '../../../src/data-migrations/types.js';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../src/data-migrations');

/** Input for {@link loadMigrationByNumber}. */
export interface LoadMigrationByNumberInput {
    /** Four-digit migration number, e.g. `'0062'`. */
    readonly number: string;
}

/**
 * Imports the data-migration whose filename starts with `<number>-`.
 *
 * @typeParam TExtra - Extra named exports the caller reads beyond `meta`/`up`.
 * @param input - The migration number to resolve.
 * @returns The imported module, typed as a migration plus the caller's extras.
 * @throws When no file in the migrations folder starts with the given number.
 */
export async function loadMigrationByNumber<TExtra extends object = object>(
    input: LoadMigrationByNumberInput
): Promise<SeedMigrationModule & TExtra> {
    const file = readdirSync(MIGRATIONS_DIR).find(
        (name) => name.startsWith(`${input.number}-`) && name.endsWith('.ts')
    );
    if (!file) {
        throw new Error(
            `No data-migration found with prefix ${input.number}- in ${MIGRATIONS_DIR}`
        );
    }
    return (await import(/* @vite-ignore */ join(MIGRATIONS_DIR, file))) as SeedMigrationModule &
        TExtra;
}
