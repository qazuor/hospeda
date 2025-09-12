import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PostEngagementStatsSchema } from '../../../src/entities/post/post.stats.schema.js';

describe('Post Stats Schemas', () => {
    describe('PostEngagementStatsSchema', () => {
        it('should validate valid engagement stats', () => {
            const validStats = {
                likes: 150,
                comments: 25,
                shares: 10
            };

            expect(() => PostEngagementStatsSchema.parse(validStats)).not.toThrow();

            const parsed = PostEngagementStatsSchema.parse(validStats);
            expect(parsed.likes).toBe(150);
            expect(parsed.comments).toBe(25);
            expect(parsed.shares).toBe(10);
        });

        it('should use default values for missing fields', () => {
            const partialStats = {};

            expect(() => PostEngagementStatsSchema.parse(partialStats)).not.toThrow();

            const parsed = PostEngagementStatsSchema.parse(partialStats);
            expect(parsed.likes).toBe(0);
            expect(parsed.comments).toBe(0);
            expect(parsed.shares).toBe(0);
        });

        it('should validate with partial data', () => {
            const partialStats = {
                likes: 100
            };

            expect(() => PostEngagementStatsSchema.parse(partialStats)).not.toThrow();

            const parsed = PostEngagementStatsSchema.parse(partialStats);
            expect(parsed.likes).toBe(100);
            expect(parsed.comments).toBe(0); // Default
            expect(parsed.shares).toBe(0); // Default
        });

        it('should reject negative values', () => {
            const invalidStats = {
                likes: -5,
                comments: 10,
                shares: 3
            };

            expect(() => PostEngagementStatsSchema.parse(invalidStats)).toThrow(ZodError);
        });

        it('should reject non-integer values', () => {
            const invalidStats = {
                likes: 10.5,
                comments: 5,
                shares: 2
            };

            expect(() => PostEngagementStatsSchema.parse(invalidStats)).toThrow(ZodError);
        });

        it('should reject invalid types', () => {
            const invalidStats = {
                likes: 'many',
                comments: true,
                shares: null
            };

            expect(() => PostEngagementStatsSchema.parse(invalidStats)).toThrow(ZodError);
        });
    });
});
