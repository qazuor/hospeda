import type { Config } from 'drizzle-kit';

/**
 * Drizzle ORM configuration for migration generation and schema definition.
 */

export default {
    schema: './src/schema',
    out: './src/migrations',
    driver: 'pg',
    dbCredentials: {
        connectionString:
            'postgresql://Hospeda_owner:npg_La2CYHS3MRXQ@ep-dry-bird-ac8a18ef-pooler.sa-east-1.aws.neon.tech/Hospeda?sslmode=require'
    }
} satisfies Config;
