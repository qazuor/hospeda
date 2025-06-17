import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../src/migrations');
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
    console.warn('DATABASE_URL not set in environment.');
    process.exit(1);
}

const main = async () => {
    // Find the most recent *_all_enum_diffs.sql file
    const files = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('_all_enum_diffs.sql'))
        .sort();
    if (files.length === 0) {
        console.info('No enum migration file found.');
        process.exit(0);
    }
    const latest = files[files.length - 1];
    const filepath = path.join(MIGRATIONS_DIR, latest);
    const sql = fs.readFileSync(filepath, 'utf8');
    console.info(`Applying enum migration: ${latest}`);
    console.warn('WARNING: This operation is destructive. Make sure you have a backup!');
    const pool = new Pool({ connectionString: DB_URL });
    try {
        await pool.query('BEGIN');
        await pool.query(sql);
        await pool.query('COMMIT');
        console.info('Enum migration applied successfully.');
    } catch (err) {
        await pool.query('ROLLBACK');
        console.warn('Error applying enum migration:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
};

main();
