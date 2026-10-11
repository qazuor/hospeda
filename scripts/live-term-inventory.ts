import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const INVENTORY_FILE = 'scripts/guards/live-term-inventories.json';
export const INVENTORY_KEYS = [
    'fila_viva',
    'grant_vivo_ancla_viva',
    'marca_abierta',
    'cortesia_diferida'
] as const;
export type InventoryKey = (typeof INVENTORY_KEYS)[number];
export type InventoryEntry = {
    readonly file: string;
    readonly symbol: string;
    readonly row: number | null;
    readonly why: string;
    readonly subject?: 'subscription' | 'addon_instance';
};
export type Inventories = Record<InventoryKey, readonly InventoryEntry[]>;
export type InventoryFinding = { readonly key: string; readonly detail: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const nonBlank = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

export function validateEntries(args: {
    readonly key: string;
    readonly entries: unknown;
}): readonly InventoryFinding[] {
    const { key, entries } = args;
    const findings: InventoryFinding[] = [];
    const add = (detail: string) => findings.push({ key, detail });
    if (!(INVENTORY_KEYS as readonly string[]).includes(key)) {
        add('unknown top-level key');
        return findings;
    }
    if (!Array.isArray(entries)) return [{ key, detail: 'entries must be an array' }];
    const seen = new Set<string>();
    entries.forEach((entry, index) => {
        if (!isObject(entry)) {
            add(`entry ${index + 1} is not an object`);
            return;
        }
        for (const field of ['file', 'symbol', 'why'] as const) {
            if (!nonBlank(entry[field])) add(`entry ${index + 1} has blank ${field}`);
        }
        if (entry.row !== null && (!Number.isInteger(entry.row) || (entry.row as number) < 1))
            add(`entry ${index + 1} row must be an integer >= 1 or null`);
        if (
            key === 'fila_viva' &&
            entry.subject !== 'subscription' &&
            entry.subject !== 'addon_instance'
        )
            add(`entry ${index + 1} has missing or invalid subject`);
        if (nonBlank(entry.file) && nonBlank(entry.symbol)) {
            const tuple = JSON.stringify([entry.file, entry.symbol]);
            if (seen.has(tuple)) add(`entry ${index + 1} repeats (file, symbol)`);
            seen.add(tuple);
        }
    });
    return findings;
}

export function loadInventories(args: { readonly root: string }): {
    readonly inventories: Partial<Record<InventoryKey, readonly unknown[]>>;
    readonly findings: readonly InventoryFinding[];
} {
    let parsed: unknown;
    try {
        parsed = JSON.parse(readFileSync(join(args.root, INVENTORY_FILE), 'utf8'));
    } catch (error) {
        return {
            inventories: {},
            findings: [
                {
                    key: 'registry',
                    detail: `cannot read or parse ${INVENTORY_FILE}: ${error instanceof Error ? error.message : 'unknown error'}`
                }
            ]
        };
    }
    if (!isObject(parsed))
        return {
            inventories: {},
            findings: [{ key: 'registry', detail: 'top-level JSON value must be an object' }]
        };
    const findings: InventoryFinding[] = [];
    for (const key of Object.keys(parsed))
        findings.push(...validateEntries({ key, entries: parsed[key] }));
    for (const key of INVENTORY_KEYS) {
        if (key in parsed) findings.push(...validateEntries({ key, entries: parsed[key] }));
        else findings.push({ key, detail: 'missing top-level key' });
    }
    return { inventories: parsed as Partial<Record<InventoryKey, readonly unknown[]>>, findings };
}
