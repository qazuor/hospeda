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
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL environment variable is not set');
        process.exit(1);
    }

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log('Refreshing search_index materialized view…');
    await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY search_index;');
    await client.end();
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log('Done.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
