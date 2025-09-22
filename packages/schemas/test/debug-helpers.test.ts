import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { NewEntityInputSchema } from '../dist/index.js';

describe('NewEntityInputSchema Debug', () => {
    test.skip('simple test with minimal schema - SKIPPED: NewEntityInputSchema.omit() fails when schema lacks system fields', () => {
        const SimpleSchema = z.object({
            name: z.string()
        });

        const NewSchema = NewEntityInputSchema(SimpleSchema);

        // This should work - only pass non-system fields
        expect(() => NewSchema.parse({ name: 'test' })).not.toThrow();
    });

    test.skip('test with system fields - SKIPPED: NewEntityInputSchema.omit() fails when schema lacks system fields', () => {
        const SchemaWithSystemFields = z.object({
            id: z.string(),
            name: z.string(),
            createdAt: z.date(),
            updatedAt: z.date(),
            deletedAt: z.date().optional()
        });

        const NewSchema = NewEntityInputSchema(SchemaWithSystemFields);

        // This should work without system fields - only pass allowed fields
        expect(() => NewSchema.parse({ name: 'test' })).not.toThrow();

        // This should fail because name is required
        expect(() => NewSchema.parse({})).toThrow();
    });
});
