/**
 * add-missing-zod-keys.ts
 *
 * Helper script to bulk-add missing zodError translation keys to the
 * three locale validation.json files (es/en/pt). Reads the list of
 * missing keys from the verifier's output and inserts them with simple
 * Spanish strings (es) / placeholder strings prefixed with [EN]/[PT]
 * for the other locales.
 *
 * Usage:
 *   pnpm exec tsx scripts/add-missing-zod-keys.ts
 *
 * Idempotent: only inserts keys that don't already exist; preserves all
 * existing translations untouched.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES = ['es', 'en', 'pt'] as const;

function defaultSpanish(keyTail: string): string {
    const parts = keyTail.split('.');
    const last = parts[parts.length - 1] ?? '';
    const field = parts[parts.length - 2] ?? 'campo';
    const fieldEs = humanize(field);

    switch (last) {
        case 'min':
            return `El ${fieldEs} debe tener al menos {{min}} caracteres`;
        case 'max':
            return `El ${fieldEs} no puede superar los {{max}} caracteres`;
        case 'required':
            return `El ${fieldEs} es obligatorio`;
        case 'invalid':
            return `El ${fieldEs} no es válido`;
        case 'invalidType':
            return `El ${fieldEs} tiene un tipo de dato inválido`;
        case 'invalidUuid':
        case 'uuid':
            return `El ${fieldEs} debe ser un UUID válido`;
        case 'invalidHex':
            return `El ${fieldEs} debe ser un código hexadecimal válido`;
        case 'invalidUrl':
        case 'url':
        case 'format':
            return `El ${fieldEs} debe tener un formato válido`;
        case 'email':
            return `El ${fieldEs} debe ser un email válido`;
        case 'positive':
            return `El ${fieldEs} debe ser positivo`;
        case 'int':
            return `El ${fieldEs} debe ser un número entero`;
        default:
            return `El ${fieldEs} no es válido (${last})`;
    }
}

function humanize(camel: string): string {
    return camel
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .trim();
}

function setIfMissing(
    obj: Record<string, unknown>,
    parts: readonly string[],
    value: string
): boolean {
    let cursor = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i] ?? '';
        if (typeof cursor[key] !== 'object' || cursor[key] === null) {
            cursor[key] = {};
        }
        cursor = cursor[key] as Record<string, unknown>;
    }
    const lastKey = parts[parts.length - 1] ?? '';
    if (lastKey in cursor) return false;
    cursor[lastKey] = value;
    return true;
}

function sortDeep(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortDeep);
    if (value && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b)
        );
        const sorted: Record<string, unknown> = {};
        for (const [k, v] of entries) sorted[k] = sortDeep(v);
        return sorted;
    }
    return value;
}

function main() {
    const repoRoot = path.resolve(__dirname, '..');

    // Run the verifier and capture the list of missing keys via spawnSync
    // (no shell, so no injection risk).
    const result = spawnSync('pnpm', ['exec', 'tsx', 'scripts/extract-zod-keys.ts', '--verify'], {
        cwd: repoRoot,
        encoding: 'utf8'
    });
    const verifierOutput = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    if (result.status === 0) {
        // biome-ignore lint/suspicious/noConsoleLog: CLI script for user-facing progress output
        console.log('No missing keys — nothing to do.');
        return;
    }

    const missingKeys = Array.from(
        new Set(
            verifierOutput
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line.startsWith('- zodError.'))
                .map((line) => line.replace(/^-\s+/, ''))
        )
    );

    if (missingKeys.length === 0) {
        // biome-ignore lint/suspicious/noConsoleLog: CLI script for user-facing progress output
        console.log('No missing keys parsed from verifier output.');
        return;
    }

    // biome-ignore lint/suspicious/noConsoleLog: CLI script for user-facing progress output
    console.log(`Found ${missingKeys.length} missing key(s).`);

    for (const locale of LOCALES) {
        const filePath = path.join(
            repoRoot,
            'packages/i18n/src/locales',
            locale,
            'validation.json'
        );
        const raw = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(raw) as Record<string, unknown>;

        let added = 0;
        for (const fullKey of missingKeys) {
            const tail = fullKey.replace(/^zodError\./, '');
            const parts = tail.split('.');
            const valueEs = defaultSpanish(tail);
            const value = locale === 'es' ? valueEs : `[${locale.toUpperCase()}] ${valueEs}`;
            if (setIfMissing(json, parts, value)) added += 1;
        }

        const sorted = sortDeep(json);
        fs.writeFileSync(filePath, `${JSON.stringify(sorted, null, 4)}\n`);
        // biome-ignore lint/suspicious/noConsoleLog: CLI script for user-facing progress output
        console.log(`  ${locale}: added ${added} key(s)`);
    }
}

main();
