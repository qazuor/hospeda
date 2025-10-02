/**
 * Tests for HTTP Schema Factory
 * Validates schema generation and coercion logic
 */
import { describe, expect, it } from 'vitest';
import { createHttpSearchSchema } from '../../src/utils/http-schema.factory.js';

describe('HTTP Schema Factory', () => {
    describe('createHttpSearchSchema', () => {
        it('should create basic search schema with pagination and sorting', () => {
            const schema = createHttpSearchSchema({});
            const result = schema.safeParse({
                page: '1',
                pageSize: '20',
                sortBy: 'createdAt',
                sortOrder: 'desc'
            });
            expect(result.success).toBe(true);
        });
    });
});
