#!/usr/bin/env node
// =============================================================================
// verify-gh-refresh.mjs
//
// Verifies that the gh_refresh role can execute refresh_search_index() with
// the password supplied via GH_REFRESH_URL. Used as a smoke-test after
// rotating the placeholder password set by 0021_create_gh_refresh_user.sql.
//
// Usage:
//   GH_REFRESH_URL='postgresql://gh_refresh:<password>@host/db?sslmode=require' \
//     node packages/db/scripts/verify-gh-refresh.mjs
// =============================================================================
import 'dotenv/config';
import pkg from 'pg';

const { Client } = pkg;

async function main() {
    const url = process.env.GH_REFRESH_URL;
    if (!url) {
        console.error('ERROR: GH_REFRESH_URL must be set');
        process.exit(1);
    }

    const client = new Client({ connectionString: url });
    await client.connect();

    const who = await client.query('SELECT current_user');
    console.info(`Connected as: ${who.rows[0].current_user}`);

    if (who.rows[0].current_user !== 'gh_refresh') {
        console.error('ERROR: Expected user gh_refresh');
        await client.end();
        process.exit(1);
    }

    await client.query('SELECT refresh_search_index()');
    console.info('refresh_search_index() executed OK');

    // Negative test: confirm gh_refresh CANNOT read tables directly.
    try {
        await client.query('SELECT count(*) FROM users');
        console.error('SECURITY: gh_refresh was able to read users table — grant misconfigured');
        await client.end();
        process.exit(1);
    } catch (err) {
        if (err.code === '42501') {
            console.info(
                'Security check OK: gh_refresh blocked from SELECT on users (permission denied)'
            );
        } else {
            console.warn(`Unexpected error during security check: ${err.message}`);
        }
    }

    await client.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
