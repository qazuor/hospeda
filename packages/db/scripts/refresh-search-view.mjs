// scripts/refresh-search-view.js
import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

async function main() {
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
