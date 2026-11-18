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
 * ## What it checks
 *
 * 1. No production file under `apps/api/src` names the script-only credential
 *    variables (`UMAMI_SETUP_API_KEY`, `UMAMI_SETUP_USERNAME`,
 *    `UMAMI_SETUP_PASSWORD`) or the recorder write fields (`replayConfig`,
 *    `recorderEnabled`).
 * 2. The env registry (`packages/config/src`) declares none of the
 *    `UMAMI_SETUP_*` variables.
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
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../../../..');

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
});
