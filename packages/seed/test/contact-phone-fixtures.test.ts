import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContactInfoSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data');

const collectJsonFiles = (root: string): string[] =>
    readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(root, entry.name);
        return entry.isDirectory()
            ? collectJsonFiles(fullPath)
            : entry.isFile() && entry.name.endsWith('.json')
              ? [fullPath]
              : [];
    });

const fixtureFiles = collectJsonFiles(directory);

describe('seed contact phone fixtures', () => {
    it('has fixtures to check', () => {
        expect(fixtureFiles.length).toBeGreaterThan(0);
        const withContact = fixtureFiles.filter((file) => {
            const fixture = JSON.parse(readFileSync(file, 'utf8')) as { contactInfo?: unknown };
            return fixture.contactInfo !== undefined;
        });
        // Guard against the per-file check below passing vacuously.
        expect(withContact.length).toBeGreaterThan(100);
    });

    it.each(fixtureFiles)('%s has valid contactInfo phone values', (file) => {
        const fixture = JSON.parse(readFileSync(file, 'utf8')) as { contactInfo?: unknown };
        if (fixture.contactInfo !== undefined) {
            expect(ContactInfoSchema.safeParse(fixture.contactInfo).success).toBe(true);
        }
    });
});
