import path from 'node:path';
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
import { config as envConfig } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeDb } from '../src/client';

// Load environment variables from root .env.local file
envConfig({
    path: path.resolve(__dirname, '../../../.env.local')
});

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

// Utility to get enum values from the database
const getDbEnumValues = async (pool: Pool, enumName: string): Promise<string[]> => {
    const { rows } = await pool.query(`SELECT unnest(enum_range(NULL::${enumName})) as value`);
    return rows.map((row) => row.value);
};

const arrayDiff = (a: string[], b: string[]) => a.filter((v) => !b.includes(v));

// This test suite ensures that all TypeScript enums are synchronized with their corresponding enums in the database.
// It checks for missing values, extra values, and order differences between TypeScript and database enums.

describe('Enum consistency between TypeScript and database', () => {
    let pool: Pool;

    beforeAll(() => {
        const connectionString = process.env.HOSPEDA_DATABASE_URL;
        if (!connectionString) {
            throw new Error(
                'HOSPEDA_DATABASE_URL is not set. Please set this environment variable in .env.local for database tests.'
            );
        }
        pool = new Pool({ connectionString });
        initializeDb(pool);
    });

    afterAll(async () => {
        await pool.end();
    });

    for (const [tsEnumName, tsEnum] of Object.entries(AllEnums)) {
        // Convention: the enum name in the database is the same as in TypeScript but snake_case and ends with _enum
        // Example: AccommodationTypeEnum -> accommodation_type_enum
        const dbEnumName = tsEnumName.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();

        it(`${tsEnumName} must be synchronized with the database enum (${dbEnumName})`, async () => {
            let dbValues: string[] = [];
            const tsValues: string[] = Object.values(tsEnum);

            try {
                dbValues = await getDbEnumValues(pool, dbEnumName);
            } catch (err) {
                const error = err as Error & { code?: string };
                // If the error is "type does not exist", report it clearly
                if (error.code === '42704' || error.message?.includes('does not exist')) {
                    throw new Error(
                        `Enum \"${dbEnumName}\" does not exist in the database for TypeScript enum \"${tsEnumName}\".\n` +
                            `Database error: ${error.message}`
                    );
                }
                // Otherwise, rethrow the error
                throw error;
            }

            const onlyInTS = arrayDiff(tsValues, dbValues);
            const onlyInDB = arrayDiff(dbValues, tsValues);

            if (onlyInTS.length || onlyInDB.length || tsValues.join(',') !== dbValues.join(',')) {
                let message = `Enum mismatch for ${tsEnumName} <-> ${dbEnumName}:\n`;
                if (onlyInTS.length) {
                    message += `  Values only in TypeScript: ${onlyInTS.join(', ')}\n`;
                }
                if (onlyInDB.length) {
                    message += `  Values only in Database: ${onlyInDB.join(', ')}\n`;
                }
                if (tsValues.join(',') !== dbValues.join(',')) {
                    message += `  Order differs:\n    TypeScript: [${tsValues.join(', ')}]\n    Database:   [${dbValues.join(', ')}]\n`;
                }
                throw new Error(message);
            }

            expect(dbValues).toEqual(tsValues);
        });
    }
});
