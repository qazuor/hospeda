import { logger } from '@repo/logger';
import { AllEnums } from '@repo/types';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../src/migrations');
const DATE_PREFIX = new Date().toISOString().slice(0, 10).replace(/-/g, '');

const getDbEnumValues = async (pool: Pool, enumName: string): Promise<string[] | null> => {
    try {
        const { rows } = await pool.query(`SELECT unnest(enum_range(NULL::${enumName})) as value`);
        return rows.map((row) => row.value);
    } catch (err) {
        const error = err as Error & { code?: string };
        if (error.code === '42704' || error.message?.includes('does not exist')) {
            return null;
        }
        throw error;
    }
};

const arrayDiff = (a: string[], b: string[]) => a.filter((v) => !b.includes(v));

const main = async () => {
    logger.info('Starting enum migration generation...');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const dbEnums: Record<string, string[]> = {};
    const tsEnums: Record<string, string[]> = {};
    const actions: Array<{ type: string; enumName: string; sql: string }> = [];

    // 1. Gather enums from TypeScript
    for (const [tsEnumName, tsEnum] of Object.entries(AllEnums)) {
        const dbEnumName = tsEnumName.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
        tsEnums[dbEnumName] = Object.values(tsEnum);
    }

    // 2. Gather enums from DB
    const { rows: enumTypes } = await pool.query(
        `SELECT t.typname as enum_name FROM pg_type t WHERE t.typtype = 'e'`
    );
    for (const { enum_name } of enumTypes) {
        dbEnums[enum_name] = (await getDbEnumValues(pool, enum_name)) || [];
    }

    // 3. Compare and generate actions
    // a) New enums (in TS, not in DB)
    for (const [dbEnumName, tsValues] of Object.entries(tsEnums)) {
        if (!dbEnums[dbEnumName]) {
            const sql = `CREATE TYPE ${dbEnumName} AS ENUM (${tsValues.map((v) => `'${v}'`).join(', ')});\n`;
            actions.push({ type: 'create', enumName: dbEnumName, sql });
            logger.info(`Will create enum: ${dbEnumName}`);
        }
    }
    // b) Removed enums (in DB, not in TS)
    for (const dbEnumName of Object.keys(dbEnums)) {
        if (!tsEnums[dbEnumName]) {
            const sql = `DROP TYPE IF EXISTS ${dbEnumName};\n`;
            actions.push({ type: 'drop', enumName: dbEnumName, sql });
            logger.info(`Will drop enum: ${dbEnumName}`);
        }
    }
    // c) Value diffs (add/remove)
    for (const [dbEnumName, tsValues] of Object.entries(tsEnums)) {
        if (!dbEnums[dbEnumName]) continue; // Already handled as new enum
        const dbValues = dbEnums[dbEnumName];
        // New values in TS
        const onlyInTS = arrayDiff(tsValues, dbValues);
        for (const v of onlyInTS) {
            const sql = `ALTER TYPE ${dbEnumName} ADD VALUE IF NOT EXISTS '${v}';\n`;
            actions.push({ type: 'add_value', enumName: dbEnumName, sql });
            logger.info(`Will add value '${v}' to enum: ${dbEnumName}`);
        }
        // Removed values in TS (exist in DB)
        const onlyInDB = arrayDiff(dbValues, tsValues);
        if (onlyInDB.length > 0) {
            // Workaround: create new type, migrate data, drop old type (not implemented here, just log)
            const sql = `-- WARNING: Removing values from enums in PostgreSQL requires manual migration.\n-- The following values exist in DB but not in TypeScript: ${onlyInDB.join(', ')}\n-- You must create a new type, update all columns, and drop the old type.\n`;
            actions.push({ type: 'remove_value', enumName: dbEnumName, sql });
            logger.warn(
                `Enum ${dbEnumName} has values in DB but not in TypeScript: ${onlyInDB.join(', ')}`
            );
        }
    }

    // 4. Write migration files
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    }
    for (const action of actions) {
        const filename = `${DATE_PREFIX}_${action.type}_enum_${action.enumName}.sql`;
        const filepath = path.join(MIGRATIONS_DIR, filename);
        fs.writeFileSync(filepath, action.sql);
        logger.info(`Generated migration file: ${filepath}`);
    }
    await pool.end();
    logger.info('Enum migration generation finished.');
};

main().catch((err) => {
    logger.error('Error generating enum migrations:', err);
    process.exit(1);
});
