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
 * HOS-2359 briefly added a second exception, a `user`-role key that created one
 * pixel per newsletter campaign. HOS-2583 removed the pixels and that key with them.
 *
 * ## The second exception (HOS-2679 PR 2)
 *
 * The admin QR campaigns panel creates one segment `QR · <campaign>` per campaign,
 * on demand. The owner decision recorded on HOS-2679 ("Decisiones tomadas") is a
 * NEW api env var holding a key with edit access to the web website, never the
 * view-only key widened. That variable, `HOSPEDA_UMAMI_WRITE_API_KEY`, is named
 * only by the files in `WRITE_API_KEY_ALLOWLIST`; any OTHER write or admin
 * credential name is still refused. The recorder write fields stay forbidden.
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
 *    keys, tokens, passwords) other than `HOSPEDA_UMAMI_WRITE_API_KEY`.
 * 4. Only the allowlisted api files name `HOSPEDA_UMAMI_DATABASE_URL`.
 * 5. Only the allowlisted api files name `HOSPEDA_UMAMI_WRITE_API_KEY`; the
 *    `writeApiKey` identifier lives only in the service and its tests; the config
 *    reader is private; the service never calls `fetch`; and the segment client's
 *    code reaches exactly one endpoint, `/api/websites/:id/segments` (one `/api/`
 *    literal, every request URL derived from it, one `fetchImpl` call).
 * 6. The registry declares exactly two secret `HOSPEDA_UMAMI_*` variables beside
 *    the view-only `HOSPEDA_UMAMI_API_KEY`: `HOSPEDA_UMAMI_DATABASE_URL` and
 *    `HOSPEDA_UMAMI_WRITE_API_KEY`.
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

/**
 * The only api files allowed to name `HOSPEDA_UMAMI_WRITE_API_KEY` (HOS-2679): the
 * env schema that validates it and the QR campaign service that reads it.
 */
const WRITE_API_KEY_ALLOWLIST = [
    'apps/api/src/utils/env-schema.ts',
    'apps/api/src/services/qr-campaign-umami.ts'
] as const;

/** The registry file allowed to declare `HOSPEDA_UMAMI_WRITE_API_KEY`. */
const WRITE_API_KEY_REGISTRY_FILE = 'packages/config/src/env-registry.hospeda.ts';

/** The one allowed write credential name (HOS-2679). */
const ALLOWED_WRITE_API_KEY = 'HOSPEDA_UMAMI_WRITE_API_KEY';

/** A Umami credential with write or admin reach, under any name. */
const WRITE_CREDENTIAL_NAME = /\bHOSPEDA_UMAMI_(WRITE|ADMIN)_[A-Z_]*(KEY|TOKEN|PASSWORD|SECRET)\b/g;

/** Write-credential names in `source` other than the allowed one. */
function forbiddenWriteNames(source: string): string[] {
    return [...source.matchAll(WRITE_CREDENTIAL_NAME)]
        .map((match) => match[0])
        .filter((name) => name !== ALLOWED_WRITE_API_KEY);
}

const FORBIDDEN_IN_API = [
    /\bUMAMI_SETUP_(API_KEY|USERNAME|PASSWORD)\b/,
    /\breplayConfig\b/,
    /\brecorderEnabled\b/
] as const;

/** The service that reads the write key, and the client it reaches Umami with. */
const SERVICE_FILE = 'apps/api/src/services/qr-campaign-umami.ts';
const CLIENT_FILE = 'apps/api/src/lib/umami-segments-client.ts';

/**
 * Files allowed to spell the `writeApiKey` identifier (HOS-2679 review): the
 * service, its unit test, and this guard. Anything else reading `.writeApiKey`
 * would be a way to the key that never names the env var.
 */
const WRITE_API_KEY_IDENTIFIER_ALLOWLIST = [
    SERVICE_FILE,
    'apps/api/test/services/qr-campaign-umami.test.ts',
    'apps/api/test/guards/no-umami-write-credential.guard.test.ts'
] as const;

/**
 * Drops block comments and whole-line `//` comments, so a docblock that
 * describes an endpoint is neither required nor counted. A trailing comment is
 * kept, which can only make the check stricter.
 */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Every way the segment client's CODE could reach an endpoint other than
 * `/api/websites/:id/segments`:
 *
 * 1. exactly one `/api/` literal, and it is the `segmentsPath` definition;
 * 2. every `url:` value (not the `readonly url: string` type) handed to the request helper is `segmentsPath` or the
 *    `url.toString()` of a `new URL(segmentsPath)`;
 * 3. every `new URL(...)` is built from `segmentsPath`;
 * 4. `fetchImpl(` is called exactly once, with `args.url`.
 *
 * @returns One message per violation; empty when the client is confined.
 */
function segmentClientEndpointViolations(code: string): string[] {
    const violations: string[] = [];
    const apiLiterals = code.match(/\/api\b[^`'"\s]*/g) ?? [];
    const definition =
        /const segmentsPath = `\$\{base\}\/api\/websites\/\$\{encodeURIComponent\(input\.websiteId\)\}\/segments`;/;
    if (apiLiterals.length !== 1 || !definition.test(code)) {
        violations.push(
            `expected one /api/ literal (segmentsPath), found ${JSON.stringify(apiLiterals)}`
        );
    }
    const urlValues = [...code.matchAll(/(?<!readonly\s)\burl:\s*([^,\n}]+)/g)].map((m) =>
        (m[1] ?? '').trim()
    );
    const badUrls = urlValues.filter(
        (value) => value !== 'segmentsPath' && value !== 'url.toString()'
    );
    if (urlValues.length === 0 || badUrls.length > 0) {
        violations.push(`request url values ${JSON.stringify(urlValues)}`);
    }
    const urlCtorArgs = [...code.matchAll(/new URL\(([^)]*)\)/g)].map((m) => (m[1] ?? '').trim());
    if (urlCtorArgs.some((arg) => arg !== 'segmentsPath')) {
        violations.push(`new URL arguments ${JSON.stringify(urlCtorArgs)}`);
    }
    const fetchCalls = [...code.matchAll(/\bfetchImpl\(([^,)]*)/g)].map((m) => (m[1] ?? '').trim());
    if (fetchCalls.length !== 1 || fetchCalls[0] !== 'args.url') {
        violations.push(`fetchImpl calls ${JSON.stringify(fetchCalls)}`);
    }
    return violations;
}

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

    it('no api or registry file names a Umami write or admin credential beyond the allowed one', () => {
        // Arrange
        const files = [
            ...listTsFiles(join(REPO_ROOT, 'apps/api/src')),
            ...listTsFiles(join(REPO_ROOT, 'packages/config/src')).filter(
                (file) => !file.includes('__tests__')
            )
        ];

        // Act
        const offenders = files.flatMap((file) =>
            forbiddenWriteNames(readFileSync(file, 'utf8')).map(
                (name) => `${relative(REPO_ROOT, file)} names ${name}`
            )
        );

        // Assert
        expect(files.length).toBeGreaterThan(100);
        expect(offenders).toEqual([]);
    });

    it('the write-credential pattern refuses any other write or admin key and ignores the website id', () => {
        expect(forbiddenWriteNames('HOSPEDA_UMAMI_WRITE_API_KEY')).toEqual([]);
        expect(forbiddenWriteNames('HOSPEDA_UMAMI_WRITE_ADMIN_KEY')).toEqual([
            'HOSPEDA_UMAMI_WRITE_ADMIN_KEY'
        ]);
        expect(forbiddenWriteNames('HOSPEDA_UMAMI_ADMIN_TOKEN')).toEqual([
            'HOSPEDA_UMAMI_ADMIN_TOKEN'
        ]);
        expect(forbiddenWriteNames('HOSPEDA_UMAMI_WEBSITE_ID_ADMIN')).toEqual([]);
        expect(forbiddenWriteNames('HOSPEDA_UMAMI_API_KEY')).toEqual([]);
    });

    it('HOSPEDA_UMAMI_WRITE_API_KEY is named only by the allowlisted files (HOS-2679 exception)', () => {
        // Arrange
        const files = [
            ...listTsFiles(join(REPO_ROOT, 'apps/api/src')),
            ...listTsFiles(join(REPO_ROOT, 'packages/config/src')).filter(
                (file) => !file.includes('__tests__')
            )
        ];

        // Act
        const namers = files
            .filter((file) => /\bHOSPEDA_UMAMI_WRITE_API_KEY\b/.test(readFileSync(file, 'utf8')))
            .map((file) => relative(REPO_ROOT, file));

        // Assert
        expect(namers.length).toBeGreaterThan(0);
        for (const namer of namers) {
            expect([...WRITE_API_KEY_ALLOWLIST, WRITE_API_KEY_REGISTRY_FILE]).toContain(namer);
        }
    });

    it('the service holding the write key never calls fetch itself', () => {
        const service = readFileSync(join(REPO_ROOT, SERVICE_FILE), 'utf8');

        expect(stripComments(service)).not.toMatch(/\bfetch\(/);
    });

    it('the segment client reaches exactly one Umami endpoint: /api/websites/:id/segments', () => {
        // Arrange
        const code = stripComments(readFileSync(join(REPO_ROOT, CLIENT_FILE), 'utf8'));

        // Assert
        expect(segmentClientEndpointViolations(code)).toEqual([]);
    });

    it('the endpoint check refuses a bare website call, another API path and a derived URL', () => {
        // Arrange
        const code = stripComments(readFileSync(join(REPO_ROOT, CLIENT_FILE), 'utf8'));
        const mutants = [
            `${code}\nconst w = \`\${base}/api/websites/\${id}\`;`,
            `${code}\nconst u = \`\${base}/api/users\`;`,
            code.replace('url: segmentsPath,', "url: segmentsPath.replace('/segments', ''),"),
            `${code}\nawait fetchImpl(other, {});`,
            `${code}\nconst x = new URL(base);`
        ];

        // Assert: every mutant is caught, and none is identical to the original.
        for (const mutant of mutants) {
            expect(mutant).not.toBe(code);
            expect(segmentClientEndpointViolations(mutant).length).toBeGreaterThan(0);
        }
    });

    it('the writeApiKey identifier lives only in the service and its tests', () => {
        // Arrange
        const files = [
            ...listTsFiles(join(REPO_ROOT, 'apps/api/src')),
            ...listTsFiles(join(REPO_ROOT, 'apps/api/test'))
        ];

        // Act
        const namers = files
            .filter((file) => /\bwriteApiKey\b/.test(readFileSync(file, 'utf8')))
            .map((file) => relative(REPO_ROOT, file));

        // Assert
        expect(namers.length).toBeGreaterThan(0);
        for (const namer of namers) {
            expect(WRITE_API_KEY_IDENTIFIER_ALLOWLIST).toContain(namer);
        }
    });

    it('the config reader that returns the write key is not exported nor imported', () => {
        // Arrange
        const service = readFileSync(join(REPO_ROOT, SERVICE_FILE), 'utf8');
        const others = listTsFiles(join(REPO_ROOT, 'apps/api/src')).filter(
            (file) => relative(REPO_ROOT, file) !== SERVICE_FILE
        );

        // Assert
        expect(service).not.toMatch(/export\s+(async\s+)?function\s+readQrCampaignUmamiConfig/);
        expect(service).not.toMatch(/export\s*\{[^}]*readQrCampaignUmamiConfig/);
        expect(
            others
                .filter((file) => /\breadQrCampaignUmamiConfig\b/.test(readFileSync(file, 'utf8')))
                .map((file) => relative(REPO_ROOT, file))
        ).toEqual([]);
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

    it('the registry has exactly two secret HOSPEDA_UMAMI_* variables beside the view-only API key', () => {
        // Arrange
        const secrets = ENV_REGISTRY.filter(
            (entry) => entry.name.startsWith('HOSPEDA_UMAMI_') && entry.secret
        ).map((entry) => entry.name);

        // Assert
        expect([...secrets].sort()).toEqual([
            'HOSPEDA_UMAMI_API_KEY',
            'HOSPEDA_UMAMI_DATABASE_URL',
            'HOSPEDA_UMAMI_WRITE_API_KEY'
        ]);
    });
});
