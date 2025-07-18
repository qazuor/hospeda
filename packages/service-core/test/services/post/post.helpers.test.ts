import { PostModel } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generatePostSlug } from '../../../src/services/post/post.helpers';

beforeEach(() => {
    vi.spyOn(PostModel.prototype, 'findOne').mockResolvedValue(null);
});

describe('generatePostSlug', () => {
    const category = 'news';
    const name = 'Hello World!';
    const date = '2024-07-03';

    it('should generate a slug for a regular post', async () => {
        const slug = await generatePostSlug(category, name, false);
        expect(typeof slug).toBe('string');
        expect(slug).toContain('hello-world');
    });

    it('should generate a slug for a news post with date', async () => {
        const slug = await generatePostSlug(category, name, true, date);
        expect(typeof slug).toBe('string');
        expect(slug).toContain('hello-world');
        expect(slug).toContain('2024-07-03');
    });

    it('should handle empty name', async () => {
        const slug = await generatePostSlug(category, '', false);
        expect(slug).toBe('news');
    });

    it('should handle special characters and multiple spaces', async () => {
        const slug = await generatePostSlug(category, '  Hello   @World!!  ', false);
        expect(slug).toContain('hello-world');
    });

    it('should lowercase all characters', async () => {
        const slug = await generatePostSlug(category, 'HeLLo WoRLD', false);
        expect(slug).toContain('hello-world');
    });

    it('should remove non-alphanumeric characters', async () => {
        const slug = await generatePostSlug(category, 'Post #1: The Beginning', false);
        expect(slug).toContain('post-1-the-beginning');
    });

    // If the function requires a fourth argument, add it here:
    // expect(generatePostSlug('Title', dummyName, dummyCategory, dummyId)).toBe(...);

    // Add more tests for other helpers if they exist
});
