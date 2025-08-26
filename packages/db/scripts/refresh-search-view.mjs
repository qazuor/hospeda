#!/usr/bin/env node
// scripts/refresh-search-view.js
import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

/**
 * Refreshes the search_index materialized view.
 * This script establishes its own database connection and does not rely
 * on the package's connection management.
 */
async function main() {
    if (!process.env.HOSPEDA_DATABASE_URL) {
        console.error('HOSPEDA_DATABASE_URL environment variable is not set');
        process.exit(1);
    }

    const client = new Client({ connectionString: process.env.HOSPEDA_DATABASE_URL });
    await client.connect();
    // eslint-disable-next-line no-console -- Script status output
    console.info('Refreshing search_index materialized view…');
    await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY search_index;');
    await client.end();
    // eslint-disable-next-line no-console -- Script status output
    console.info('Done.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
