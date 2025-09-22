import { logger } from '@repo/logger';
import {
    AccommodationTypeEnum,
    AmenitiesTypeEnum,
    AuthProviderEnum,
    BillingCycleEnum,
    ClientTypeEnum,
    EntityPermissionReasonEnum,
    EntityTypeEnum,
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PaymentMethodEnum,
    PaymentStatusEnum,
    PermissionEnum,
    PostCategoryEnum,
    PreferredContactEnum,
    PriceCurrencyEnum,
    RecurrenceTypeEnum,
    RoleEnum,
    SubscriptionStatusEnum,
    TagColorEnum,
    VisibilityEnum
} from '@repo/schemas';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

// Recreate AllEnums from schemas
const AllEnums = {
    AccommodationTypeEnum,
    AmenitiesTypeEnum,
    AuthProviderEnum,
    BillingCycleEnum,
    ClientTypeEnum,
    EntityPermissionReasonEnum,
    EntityTypeEnum,
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PaymentMethodEnum,
    PaymentStatusEnum,
    PermissionEnum,
    PostCategoryEnum,
    PreferredContactEnum,
    PriceCurrencyEnum,
    RecurrenceTypeEnum,
    RoleEnum,
    SubscriptionStatusEnum,
    TagColorEnum,
    VisibilityEnum
};

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
    const pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
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
    // c) Value diffs (add/remove/reorder)
    for (const [dbEnumName, tsValues] of Object.entries(tsEnums)) {
        if (!dbEnums[dbEnumName]) continue; // Already handled as new enum
        const dbValues = dbEnums[dbEnumName];
        // New values in TS
        const onlyInTS = arrayDiff(tsValues, dbValues);
        // Removed values in TS (exist in DB)
        const onlyInDB = arrayDiff(dbValues, tsValues);
        // Orden diferente
        const orderDiffers = tsValues.join(',') !== dbValues.join(',');

        if (onlyInDB.length > 0 || orderDiffers) {
            // Complex migration: create new type, migrate columns, delete old, rename
            // 1. Create the new type
            const createNewEnumSQL = `CREATE TYPE ${dbEnumName}_new AS ENUM (${tsValues.map((v) => `'${v}'`).join(', ')});`;
            // 2. Find columns using the enum and their defaults
            const { rows: columns } = await pool.query(`
                SELECT table_name, column_name, column_default
                FROM information_schema.columns
                WHERE udt_name = '${dbEnumName}'
            `);
            // 3. Generate ALTER TABLE for each column (handling default)
            const alterColumnsSQL = columns
                .map(({ table_name, column_name, column_default }) => {
                    const dropDefault = column_default
                        ? `ALTER TABLE "${table_name}" ALTER COLUMN "${column_name}" DROP DEFAULT;\n`
                        : '';
                    const alterType = `ALTER TABLE "${table_name}" ALTER COLUMN "${column_name}" TYPE ${dbEnumName}_new USING "${column_name}"::text::${dbEnumName}_new;`;
                    return `${dropDefault}${alterType}`;
                })
                .join('\n');
            // 4. Drop the old type
            const dropOldEnumSQL = `DROP TYPE ${dbEnumName};`;
            // 5. Rename the new type
            const renameEnumSQL = `ALTER TYPE ${dbEnumName}_new RENAME TO ${dbEnumName};`;
            // 6. Restore defaults after the rename
            const restoreDefaultsSQL = columns
                .filter(({ column_default }) => column_default)
                .map(({ table_name, column_name, column_default }) => {
                    // The default can be e.g. 'ACTIVE'::lifecycle_status_enum
                    // We rewrite it to point to the new type (now renamed)
                    // If it's a literal value or a function, we keep it as is
                    // Example: 'ACTIVE'::lifecycle_status_enum -> 'ACTIVE'::${dbEnumName}
                    let newDefault = column_default;
                    // Replace the old type with the new (now renamed)
                    newDefault = newDefault.replace(
                        new RegExp(`::${dbEnumName}(_new)?`, 'g'),
                        `::${dbEnumName}`
                    );
                    return `ALTER TABLE "${table_name}" ALTER COLUMN "${column_name}" SET DEFAULT ${newDefault};`;
                })
                .join('\n');
            // 7. Warning if there is data with values not present in the new enum
            const warning =
                onlyInDB.length > 0
                    ? `-- WARNING: The following values exist in DB but not in TypeScript: ${onlyInDB.join(', ')}\n-- You must ensure no data uses these values before running this migration.\n`
                    : '';
            const fullMigrationSQL = [
                warning,
                createNewEnumSQL,
                alterColumnsSQL,
                dropOldEnumSQL,
                renameEnumSQL,
                restoreDefaultsSQL
            ].join('\n');
            actions.push({ type: 'replace_enum', enumName: dbEnumName, sql: fullMigrationSQL });
            logger.warn(
                `Enum ${dbEnumName} will be fully replaced (removed values or order change). Manual data cleanup may be required if values are in use.`
            );
            continue; // No need to add/remove individual values
        }
        // Si solo hay valores nuevos, usar ADD VALUE
        for (const v of onlyInTS) {
            const sql = `ALTER TYPE ${dbEnumName} ADD VALUE IF NOT EXISTS '${v}';\n`;
            actions.push({ type: 'add_value', enumName: dbEnumName, sql });
            logger.info(`Will add value '${v}' to enum: ${dbEnumName}`);
        }
    }

    // 4. Write migration files
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    }
    if (actions.length > 0) {
        const filename = `${DATE_PREFIX}_all_enum_diffs.sql`;
        const filepath = path.join(MIGRATIONS_DIR, filename);
        const allSql = actions
            .map(
                (action) =>
                    `-- ${action.type.toUpperCase()} for ${action.enumName}\n${action.sql}\n`
            )
            .join('\n');
        fs.writeFileSync(filepath, allSql);
        logger.info(`Generated single migration file: ${filepath}`);
    } else {
        logger.info('No enum differences found. No migration file generated.');
    }
    await pool.end();
    logger.info('Enum migration generation finished.');
};

main().catch((err) => {
    logger.error('Error generating enum migrations:', err);
    process.exit(1);
});
