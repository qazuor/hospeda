import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { NewEntityInputSchema } from '../src/index.js';

describe('NewEntityInputSchema Debug', () => {
    test('should omit system fields from a schema that has them', () => {
        const SchemaWithSystemFields = z.object({
            id: z.string(),
            name: z.string(),
            createdAt: z.date(),
            updatedAt: z.date(),
            deletedAt: z.date().optional(),
            createdById: z.string(),
            updatedById: z.string(),
            deletedById: z.string().optional()
        });

        const NewSchema = NewEntityInputSchema(SchemaWithSystemFields);

        // This should work without system fields - only pass allowed fields
        expect(() => NewSchema.parse({ name: 'test' })).not.toThrow();

        // This should fail because name is required
        expect(() => NewSchema.parse({})).toThrow();
    });

    test('should fail at parse time when schema lacks system fields referenced by omit', () => {
        const SimpleSchema = z.object({
            name: z.string()
        });

        // NewEntityInputSchema creates a schema, but omitting non-existent keys
        // causes Zod v4 to throw "Unrecognized key" errors at parse time
        const NewSchema = NewEntityInputSchema(SimpleSchema);
        expect(() => NewSchema.parse({ name: 'test' })).toThrow(/Unrecognized key/);
    });
});
