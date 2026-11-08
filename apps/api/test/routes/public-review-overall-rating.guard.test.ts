/**
 * @file public-review-overall-rating.guard.test.ts
 * @description HOS-2082 producer-side guard: the public venue and experience
 * review readers must project `overallRating`, because the web review card
 * shows it instead of the dimension mean (`averageRating`).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '../../../..');

describe.each([
    'apps/api/src/routes/venue/public/getReviews.ts',
    'apps/api/src/routes/experience/public/getReviews.ts'
])('%s (HOS-2082)', (file) => {
    it('projects overallRating in the public response schema', () => {
        const src = readFileSync(resolve(REPO_ROOT, file), 'utf8');
        expect(src).toMatch(/\.pick\(\{[^}]*overallRating:\s*true/s);
    });
});
