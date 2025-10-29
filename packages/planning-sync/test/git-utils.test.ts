/**
 * Git Utils Tests
 * Tests for git status parsing and commit suggestions
 */

import { describe, expect, it } from 'vitest';
import { suggestCommits } from '../src/git-utils.js';
import type { GitChangedFile } from '../src/git-utils.js';

describe('suggestCommits', () => {
    it('should group schema files separately', () => {
        const files: GitChangedFile[] = [
            { path: 'packages/schemas/src/entities/user.schema.ts', status: 'A', staged: false },
            { path: 'packages/db/src/models/user.model.ts', status: 'M', staged: false }
        ];

        const suggestions = suggestCommits(files, 'Create User model');

        expect(suggestions).toHaveLength(2);
        expect(suggestions[0].message).toContain('schemas');
        expect(suggestions[1].message).toContain('db');
    });

    it('should group model with its tests', () => {
        const files: GitChangedFile[] = [
            { path: 'packages/db/src/models/user.model.ts', status: 'A', staged: false },
            { path: 'packages/db/test/models/user.model.test.ts', status: 'A', staged: false }
        ];

        const suggestions = suggestCommits(files, 'Implement User model');

        expect(suggestions).toHaveLength(1);
        expect(suggestions[0].files).toContain('packages/db/src/models/user.model.ts');
        expect(suggestions[0].files).toContain('packages/db/test/models/user.model.test.ts');
    });

    it('should use feat type for new files', () => {
        const files: GitChangedFile[] = [
            { path: 'packages/db/src/models/user.model.ts', status: 'A', staged: false }
        ];

        const suggestions = suggestCommits(files, 'Create User model');

        expect(suggestions[0].message).toMatch(/^feat\(/);
    });

    it('should use refactor type for modified files', () => {
        const files: GitChangedFile[] = [
            { path: 'packages/db/src/models/user.model.ts', status: 'M', staged: false }
        ];

        const suggestions = suggestCommits(files, 'Update User model');

        expect(suggestions[0].message).toMatch(/^refactor\(/);
    });

    it('should generate git add commands', () => {
        const files: GitChangedFile[] = [
            { path: 'packages/db/src/models/user.model.ts', status: 'A', staged: false }
        ];

        const suggestions = suggestCommits(files, 'Create User model');

        expect(suggestions[0].addCommand).toContain('git add');
        expect(suggestions[0].addCommand).toContain('packages/db/src/models/user.model.ts');
    });

    it('should generate commit messages with body', () => {
        const files: GitChangedFile[] = [
            { path: 'packages/db/src/models/user.model.ts', status: 'A', staged: false },
            { path: 'packages/db/test/models/user.model.test.ts', status: 'A', staged: false }
        ];

        const suggestions = suggestCommits(files, 'Implement User model');

        expect(suggestions[0].body).toBeTruthy();
        expect(suggestions[0].body).toContain('Related to: Implement User model');
    });

    it('should handle multiple packages', () => {
        const files: GitChangedFile[] = [
            { path: 'packages/db/src/models/user.model.ts', status: 'A', staged: false },
            {
                path: 'packages/service-core/src/services/user.service.ts',
                status: 'A',
                staged: false
            },
            { path: 'apps/api/src/routes/user.routes.ts', status: 'A', staged: false }
        ];

        const suggestions = suggestCommits(files, 'Implement User feature');

        expect(suggestions.length).toBeGreaterThanOrEqual(3);
    });

    it('should extract action from task title', () => {
        const files: GitChangedFile[] = [
            { path: 'packages/db/src/models/user.model.ts', status: 'A', staged: false }
        ];

        const suggestions = suggestCommits(files, 'Create User model with validation');

        expect(suggestions[0].message).toContain('model');
    });

    it('should handle empty file list', () => {
        const files: GitChangedFile[] = [];

        const suggestions = suggestCommits(files, 'Some task');

        expect(suggestions).toHaveLength(0);
    });
});
