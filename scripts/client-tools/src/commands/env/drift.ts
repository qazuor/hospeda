import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type EnvDriftFile = {
    readonly file: string;
    readonly missing: readonly string[];
    readonly requiredMissing: readonly string[];
    readonly optionalMissing: readonly string[];
    readonly obsolete: readonly string[];
    readonly needsValue: readonly string[];
};

export type EnvDriftReport = {
    readonly clean: boolean;
    readonly files: readonly EnvDriftFile[];
    readonly mismatched: readonly string[];
    readonly absentCrossChecks: readonly string[];
};

const LOCAL_FILES = [
    'apps/api/.env.local',
    'apps/web/.env.local',
    'apps/admin/.env.local',
    'docker/.env'
] as const;

const CROSS_CHECKS = [
    ['apps/api/.env.local', 'apps/web/.env.local', 'HOSPEDA_REVALIDATION_SECRET'],
    ['apps/api/.env.local', 'apps/web/.env.local', 'HOSPEDA_INTERNAL_REQUEST_SECRET']
] as const;

type Entry = { readonly key: string; readonly active: boolean; readonly value: string | null };

function parse(content: string): Map<string, Entry> {
    const entries = new Map<string, Entry>();
    for (const raw of content.split(/\r?\n/)) {
        const match = raw.match(/^\s*(#\s*)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match) continue;
        const comment = match[1];
        const key = match[2];
        const value = match[3] ?? '';
        if (!key) continue;
        entries.set(key, { key, active: !comment, value: comment ? null : value });
    }
    return entries;
}

function readEntries(path: string): Map<string, Entry> {
    return existsSync(path) ? parse(readFileSync(path, 'utf8')) : new Map();
}

function templatePath(root: string, local: string): string {
    return local.endsWith('.env.local')
        ? join(root, `${local.slice(0, -'.local'.length)}.example`)
        : join(root, `${local}.example`);
}

function valueFor(entries: Map<string, Entry>, key: string): string | null {
    const entry = entries.get(key);
    return entry?.active && entry.value !== null && entry.value !== '' ? entry.value : null;
}

/** Collects drift without returning any values. */
export function collectEnvDrift({ root }: { readonly root: string }): EnvDriftReport {
    const files: EnvDriftFile[] = [];
    const parsed = new Map<string, Map<string, Entry>>();

    for (const file of LOCAL_FILES) {
        const local = readEntries(join(root, file));
        const template = readEntries(templatePath(root, file));
        parsed.set(file, local);
        const missing: string[] = [];
        const requiredMissing: string[] = [];
        const optionalMissing: string[] = [];
        const obsolete: string[] = [];
        const needsValue: string[] = [];
        for (const [key, expected] of template) {
            const actual = local.get(key);
            if (!actual) {
                missing.push(key);
                (expected.active ? requiredMissing : optionalMissing).push(key);
            } else if (expected.active && !actual.active) needsValue.push(key);
        }
        for (const key of local.keys()) if (!template.has(key)) obsolete.push(key);
        files.push({
            file,
            missing: missing.sort(),
            requiredMissing: requiredMissing.sort(),
            optionalMissing: optionalMissing.sort(),
            obsolete: obsolete.sort(),
            needsValue: needsValue.sort()
        });
    }

    const mismatched: string[] = [];
    const absentCrossChecks: string[] = [];
    for (const [leftFile, rightFile, key] of CROSS_CHECKS) {
        const left = valueFor(parsed.get(leftFile) ?? new Map(), key);
        const right = valueFor(parsed.get(rightFile) ?? new Map(), key);
        if (left === null || right === null) absentCrossChecks.push(key);
        else if (left !== right) mismatched.push(key);
    }

    const clean =
        files.every(
            (file) =>
                file.requiredMissing.length === 0 &&
                file.obsolete.length === 0 &&
                file.needsValue.length === 0
        ) && mismatched.length === 0;
    return { clean, files, mismatched, absentCrossChecks };
}
