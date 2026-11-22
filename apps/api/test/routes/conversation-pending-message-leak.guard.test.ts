/**
 * HOS-2568 leak guard: `conversations.pending_message` holds an UNVERIFIED guest's text.
 *
 * Until the email is verified that text must not reach the owner, a guest-public
 * response or any other read. Two layers:
 *
 *   1. Every exported Zod object schema about conversations must not declare the field,
 *      and parsing a raw row that carries it must strip it (the response backstop
 *      `stripWithSchema` relies on the schema dropping unknown keys).
 *   2. No source file under `apps/api/src` or `packages/schemas/src` may mention the
 *      identifier at all. It belongs to the service and the DB schema only.
 *
 * Runs without a database.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as schemas from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { ZodObject, ZodRawShape } from 'zod';

const FIELD = 'pendingMessage';
const REPO_ROOT = resolve(__dirname, '../../../..');

function isObjectSchema(value: unknown): value is ZodObject<ZodRawShape> {
    return (
        typeof value === 'object' &&
        value !== null &&
        'shape' in value &&
        typeof (value as { safeParse?: unknown }).safeParse === 'function'
    );
}

const conversationObjectSchemas = Object.entries(schemas as Record<string, unknown>).filter(
    (entry): entry is [string, ZodObject<ZodRawShape>] =>
        /conversation/i.test(entry[0]) && isObjectSchema(entry[1])
);

function listSourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return listSourceFiles(path);
        return /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
}

describe('HOS-2568 pending_message never leaks', () => {
    it('finds the conversation schemas it is meant to guard', () => {
        expect(conversationObjectSchemas.length).toBeGreaterThan(5);
    });

    it.each(conversationObjectSchemas)('%s does not declare the field', (_name, schema) => {
        expect(Object.keys(schema.shape)).not.toContain(FIELD);
    });

    it.each(conversationObjectSchemas)('%s strips the field from a raw row', (_name, schema) => {
        const parsed = schema.safeParse({ [FIELD]: 'unverified guest text' });
        // A partial row may fail on required keys; when it parses, the field must be gone.
        if (parsed.success) {
            expect(parsed.data).not.toHaveProperty(FIELD);
        }
    });

    it('is mentioned by no API route or shared schema source file', () => {
        const offenders = [
            ...listSourceFiles(join(REPO_ROOT, 'apps/api/src')),
            ...listSourceFiles(join(REPO_ROOT, 'packages/schemas/src'))
        ].filter((file) => readFileSync(file, 'utf8').includes(FIELD));

        expect(offenders).toEqual([]);
    });
});
