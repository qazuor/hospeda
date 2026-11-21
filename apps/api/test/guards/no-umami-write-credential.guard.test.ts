/**
 * Guard: the api never holds a write-capable Umami credential (HOS-2347 AC-S6).
 *
 * ## Why
 *
 * HOS-2347 Option A keeps every Umami recorder parameter (`recorder_enabled`,
 * `replay_config`) in Umami, written only by `pnpm umami:setup` with
 * script-only credentials. The Hospeda switch is a `platform_settings` row.
 * `HOSPEDA_UMAMI_API_KEY` is view-only by registry contract. If the api ever
 * learned the setup credentials, or started writing a website's recorder
 * config, the "api never writes Umami" property would be gone.
 *
 * ## The one exception (HOS-2347 retention)
 *
 * The recording retention purge needs a DELETE, and Umami 3.5 has no age-based
 * delete API. The owner decision (2026-11-18) is a direct Postgres connection
 * through `HOSPEDA_UMAMI_DATABASE_URL`, a dedicated role that can only SELECT
 * and DELETE on `session_replay` and `heatmap_event`. That variable is the
 * SINGLE allowed exception: only the files in `DATABASE_URL_ALLOWLIST` may
 * name it, and any other Umami write credential (an API key with write scope,
 * an admin key, a username or password) is still refused.
 *
 * ## What it checks
 *
 * 1. No production file under `apps/api/src` names the script-only credential
 *    variables (`UMAMI_SETUP_API_KEY`, `UMAMI_SETUP_USERNAME`,
 *    `UMAMI_SETUP_PASSWORD`) or the recorder write fields (`replayConfig`,
 *    `recorderEnabled`).
 * 2. The env registry (`packages/config/src`) declares none of the
 *    `UMAMI_SETUP_*` variables.
 * 3. No file under `apps/api/src` or `packages/config/src` names a Umami
 *    write or admin credential (`HOSPEDA_UMAMI_WRITE_*`, `HOSPEDA_UMAMI_ADMIN_*`
 *    keys, tokens, passwords).
 * 4. Only the allowlisted api files name `HOSPEDA_UMAMI_DATABASE_URL`.
 * 5. The registry declares exactly one secret `HOSPEDA_UMAMI_*` variable beside
 *    the view-only `HOSPEDA_UMAMI_API_KEY`: `HOSPEDA_UMAMI_DATABASE_URL`.
 *
 * ## What it does NOT see
 *
 * - A credential assembled at runtime from fragments, or read under another
 *   name.
 * - A raw `fetch` to `/api/websites/:id` that sends a body built elsewhere
 *   without naming those fields.
 * It reads source text, like the other guards in this folder.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENV_REGISTRY } from '@repo/config';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../../../..');

/**
 * The only api files allowed to name `HOSPEDA_UMAMI_DATABASE_URL`: the env
 * schema that validates it and the purge service that reads it.
 */
const DATABASE_URL_ALLOWLIST = [
    'apps/api/src/utils/env-schema.ts',
    'apps/api/src/services/session-recording-purge.ts'
] as const;

/** A Umami credential with write or admin reach, under any name. */
const WRITE_CREDENTIAL_NAME = /\bHOSPEDA_UMAMI_(WRITE|ADMIN)_[A-Z_]*(KEY|TOKEN|PASSWORD|SECRET)\b/;

const FORBIDDEN_IN_API = [
    /\bUMAMI_SETUP_(API_KEY|USERNAME|PASSWORD)\b/,
    /\breplayConfig\b/,
    /\brecorderEnabled\b/
] as const;

/** Lists every `.ts` file under `dir`, recursively. */
function listTsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...listTsFiles(full));
        } else if (full.endsWith('.ts')) {
            out.push(full);
        }
    }
    return out;
}

describe('the api holds no write-capable Umami credential (HOS-2347 AC-S6)', () => {
    it('no apps/api/src file names the setup credentials or the recorder write fields', () => {
        // Arrange
        const files = listTsFiles(join(REPO_ROOT, 'apps/api/src'));

        // Act
        const offenders = files.flatMap((file) => {
            const source = readFileSync(file, 'utf8');
            return FORBIDDEN_IN_API.filter((pattern) => pattern.test(source)).map(
                (pattern) => `${relative(REPO_ROOT, file)} matches ${pattern}`
            );
        });

        // Assert
        expect(files.length).toBeGreaterThan(100);
        expect(offenders).toEqual([]);
    });

    it('the env registry declares no UMAMI_SETUP_* variable', () => {
        const files = listTsFiles(join(REPO_ROOT, 'packages/config/src')).filter(
            (file) => !file.includes('__tests__')
        );

        const offenders = files.filter((file) =>
            /\bUMAMI_SETUP_[A-Z_]+\b/.test(readFileSync(file, 'utf8'))
        );

        expect(files.length).toBeGreaterThan(0);
        expect(offenders.map((file) => relative(REPO_ROOT, file))).toEqual([]);
    });

    it('no api or registry file names a Umami write or admin credential', () => {
        // Arrange
        const files = [
            ...listTsFiles(join(REPO_ROOT, 'apps/api/src')),
            ...listTsFiles(join(REPO_ROOT, 'packages/config/src')).filter(
                (file) => !file.includes('__tests__')
            )
        ];

        // Act
        const offenders = files.filter((file) =>
            WRITE_CREDENTIAL_NAME.test(readFileSync(file, 'utf8'))
        );

        // Assert
        expect(files.length).toBeGreaterThan(100);
        expect(offenders.map((file) => relative(REPO_ROOT, file))).toEqual([]);
    });

    it('the write-credential pattern refuses an api write key and accepts the website id', () => {
        expect(WRITE_CREDENTIAL_NAME.test('HOSPEDA_UMAMI_WRITE_API_KEY')).toBe(true);
        expect(WRITE_CREDENTIAL_NAME.test('HOSPEDA_UMAMI_ADMIN_TOKEN')).toBe(true);
        expect(WRITE_CREDENTIAL_NAME.test('HOSPEDA_UMAMI_WEBSITE_ID_ADMIN')).toBe(false);
        expect(WRITE_CREDENTIAL_NAME.test('HOSPEDA_UMAMI_API_KEY')).toBe(false);
    });

    it('HOSPEDA_UMAMI_DATABASE_URL is named only by the allowlisted api files (HOS-2347 exception)', () => {
        // Arrange
        const files = listTsFiles(join(REPO_ROOT, 'apps/api/src'));

        // Act
        const namers = files
            .filter((file) => /\bHOSPEDA_UMAMI_DATABASE_URL\b/.test(readFileSync(file, 'utf8')))
            .map((file) => relative(REPO_ROOT, file));

        // Assert
        expect(namers.length).toBeGreaterThan(0);
        for (const namer of namers) {
            expect(DATABASE_URL_ALLOWLIST).toContain(namer);
        }
    });

    it('the registry has exactly one secret HOSPEDA_UMAMI_* variable beside the view-only API key', () => {
        // Arrange
        const secrets = ENV_REGISTRY.filter(
            (entry) => entry.name.startsWith('HOSPEDA_UMAMI_') && entry.secret
        ).map((entry) => entry.name);

        // Assert
        expect([...secrets].sort()).toEqual([
            'HOSPEDA_UMAMI_API_KEY',
            'HOSPEDA_UMAMI_DATABASE_URL'
        ]);
    });
});
