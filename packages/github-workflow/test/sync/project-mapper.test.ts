/**
 * Tests for project mapper
 *
 * @module test/sync/project-mapper
 */

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_MONOREPO_MAPPINGS,
	ProjectMapper,
	assignProjectToFiles,
	createDefaultProjectMapper,
	type ProjectMapping
} from '../../src/sync/project-mapper';

describe('project-mapper', () => {
	describe('ProjectMapper', () => {
		describe('constructor', () => {
			it('should create instance with mappings', () => {
				const mappings: ProjectMapping[] = [
					{ name: 'Web', patterns: ['apps/web/**'] }
				];
				const mapper = new ProjectMapper({ mappings });

				expect(mapper).toBeInstanceOf(ProjectMapper);
			});

			it('should sort mappings by priority', () => {
				const mappings: ProjectMapping[] = [
					{ name: 'Low', patterns: ['**'], priority: 1 },
					{ name: 'High', patterns: ['**'], priority: 10 },
					{ name: 'Medium', patterns: ['**'], priority: 5 }
				];
				const mapper = new ProjectMapper({ mappings });

				// High priority should be checked first
				const assignment = mapper.assignProject(['test.ts']);
				expect(assignment.project).toBe('High');
			});
		});

		describe('assignProject', () => {
			it('should assign to exact path match', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'Web', patterns: ['apps/web/src/index.ts'] }]
				});

				const assignment = mapper.assignProject(['apps/web/src/index.ts']);

				expect(assignment.project).toBe('Web');
				expect(assignment.confidence).toBe(1.0);
				expect(assignment.isDefault).toBe(false);
			});

			it('should assign to glob pattern match', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'Web', patterns: ['apps/web/**'] }]
				});

				const assignment = mapper.assignProject(['apps/web/src/pages/Home.tsx']);

				expect(assignment.project).toBe('Web');
				expect(assignment.matchedPattern).toBe('apps/web/**');
				expect(assignment.confidence).toBe(1.0);
			});

			it('should handle wildcard in path segment', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'Tests', patterns: ['**/*.test.ts'] }]
				});

				const assignment = mapper.assignProject(['src/models/user.test.ts']);

				expect(assignment.project).toBe('Tests');
			});

			it('should handle double wildcard', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'Docs', patterns: ['**/docs/**'] }]
				});

				const assignment = mapper.assignProject(['apps/web/docs/guide.md']);

				expect(assignment.project).toBe('Docs');
			});

			it('should return default project when no match', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'Web', patterns: ['apps/web/**'] }],
					defaultProject: 'General'
				});

				const assignment = mapper.assignProject(['apps/api/src/routes.ts']);

				expect(assignment.project).toBe('General');
				expect(assignment.confidence).toBe(0.5);
				expect(assignment.isDefault).toBe(true);
			});

			it('should return first mapping as fallback when no default', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'Fallback', patterns: ['never-matches'] }]
				});

				const assignment = mapper.assignProject(['test.ts']);

				expect(assignment.project).toBe('Fallback');
				expect(assignment.confidence).toBe(0.0);
			});

			it('should respect priority order', () => {
				const mapper = new ProjectMapper({
					mappings: [
						{ name: 'Low', patterns: ['**/*.ts'], priority: 1 },
						{ name: 'High', patterns: ['**/*.ts'], priority: 10 }
					]
				});

				const assignment = mapper.assignProject(['test.ts']);

				expect(assignment.project).toBe('High');
			});

			it('should handle case insensitive matching by default', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'Web', patterns: ['APPS/WEB/**'] }],
					caseSensitive: false
				});

				const assignment = mapper.assignProject(['apps/web/src/index.ts']);

				expect(assignment.project).toBe('Web');
			});

			it('should handle case sensitive matching when enabled', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'Web', patterns: ['APPS/WEB/**'] }],
					caseSensitive: true,
					defaultProject: 'General'
			});

				const assignment = mapper.assignProject(['apps/web/src/index.ts']);

				// Should not match due to case sensitivity, falls back to default
				expect(assignment.project).toBe('General');
				expect(assignment.isDefault).toBe(true);
			});

			it('should include project ID when available', () => {
				const mapper = new ProjectMapper({
					mappings: [
						{
							name: 'Web',
							id: 'proj-123',
							patterns: ['apps/web/**']
						}
					]
				});

				const assignment = mapper.assignProject(['apps/web/src/index.ts']);

				expect(assignment.project).toBe('Web');
				expect(assignment.projectId).toBe('proj-123');
			});

			it('should match first file in array', () => {
				const mapper = new ProjectMapper({
					mappings: [
						{ name: 'Web', patterns: ['apps/web/**'], priority: 10 },
						{ name: 'API', patterns: ['apps/api/**'], priority: 5 }
					]
				});

				const assignment = mapper.assignProject([
					'apps/api/src/routes.ts',
					'apps/web/src/pages/Home.tsx'
				]);

				// Web has higher priority and is matched first
				expect(assignment.project).toBe('Web');
			});
		});

		describe('groupByProject', () => {
			it('should group files by project', () => {
				const mapper = new ProjectMapper({
					mappings: [
						{ name: 'Web', patterns: ['apps/web/**'] },
						{ name: 'API', patterns: ['apps/api/**'] }
					]
				});

				const groups = mapper.groupByProject([
					'apps/web/src/Home.tsx',
					'apps/api/src/routes.ts',
					'apps/web/src/Button.tsx'
				]);

				expect(groups.size).toBe(2);
				expect(groups.get('Web')).toEqual([
					'apps/web/src/Home.tsx',
					'apps/web/src/Button.tsx'
				]);
				expect(groups.get('API')).toEqual(['apps/api/src/routes.ts']);
			});

			it('should handle empty file list', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'Web', patterns: ['apps/web/**'] }]
				});

				const groups = mapper.groupByProject([]);

				expect(groups.size).toBe(0);
			});

			it('should group all unmatched to default project', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'Web', patterns: ['apps/web/**'] }],
					defaultProject: 'General'
				});

				const groups = mapper.groupByProject([
					'apps/api/test.ts',
					'packages/db/model.ts'
				]);

				expect(groups.size).toBe(1);
				expect(groups.get('General')).toEqual([
					'apps/api/test.ts',
					'packages/db/model.ts'
				]);
			});
		});

		describe('getProjects', () => {
			it('should return all configured projects', () => {
				const mapper = new ProjectMapper({
					mappings: [
						{ name: 'Web', patterns: ['apps/web/**'] },
						{ name: 'API', patterns: ['apps/api/**'] }
					]
				});

				const projects = mapper.getProjects();

				expect(projects).toEqual(['Web', 'API']);
			});

			it('should include default project if not in mappings', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'Web', patterns: ['apps/web/**'] }],
					defaultProject: 'General'
				});

				const projects = mapper.getProjects();

				expect(projects).toContain('General');
			});

			it('should not duplicate default project if already in mappings', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'General', patterns: ['**'] }],
					defaultProject: 'General'
				});

				const projects = mapper.getProjects();

				expect(projects.filter((p) => p === 'General')).toHaveLength(1);
			});
		});

		describe('getMapping', () => {
			it('should return mapping for project', () => {
				const mapping: ProjectMapping = {
					name: 'Web',
					patterns: ['apps/web/**'],
					description: 'Web app'
				};
				const mapper = new ProjectMapper({ mappings: [mapping] });

				const result = mapper.getMapping('Web');

				expect(result).toEqual(mapping);
			});

			it('should return undefined for non-existent project', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'Web', patterns: ['apps/web/**'] }]
				});

				const result = mapper.getMapping('NonExistent');

				expect(result).toBeUndefined();
			});
		});

		describe('pattern matching', () => {
			it('should match exact paths', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'Exact', patterns: ['exact/path/file.ts'] }]
				});

				expect(mapper.assignProject(['exact/path/file.ts']).project).toBe('Exact');
			});

			it('should match single wildcard', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'Test', patterns: ['src/*.ts'] }],
					defaultProject: 'Other'
				});

				expect(mapper.assignProject(['src/file.ts']).project).toBe('Test');
				expect(mapper.assignProject(['src/nested/file.ts']).project).toBe(
					'Other'
				);
			});

			it('should match double wildcard', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'All', patterns: ['src/**/*.ts'] }]
				});

				expect(mapper.assignProject(['src/file.ts']).project).toBe('All');
				expect(mapper.assignProject(['src/nested/file.ts']).project).toBe('All');
				expect(mapper.assignProject(['src/deep/nested/file.ts']).project).toBe(
					'All'
				);
			});

			it('should match patterns with special regex characters', () => {
				const mapper = new ProjectMapper({
					mappings: [{ name: 'Special', patterns: ['src/(component)/file.ts'] }]
				});

				expect(mapper.assignProject(['src/(component)/file.ts']).project).toBe(
					'Special'
				);
			});
		});
	});

	describe('DEFAULT_MONOREPO_MAPPINGS', () => {
		it('should have all expected projects', () => {
			const projectNames = DEFAULT_MONOREPO_MAPPINGS.map((m) => m.name);

			expect(projectNames).toContain('Web App');
			expect(projectNames).toContain('Admin Dashboard');
			expect(projectNames).toContain('API');
			expect(projectNames).toContain('Database');
			expect(projectNames).toContain('Schemas');
			expect(projectNames).toContain('Payments');
			expect(projectNames).toContain('Infrastructure');
			expect(projectNames).toContain('Documentation');
			expect(projectNames).toContain('Testing');
		});

		it('should have priorities set', () => {
			DEFAULT_MONOREPO_MAPPINGS.forEach((mapping) => {
				expect(mapping.priority).toBeGreaterThanOrEqual(0);
			});
		});

		it('should have patterns defined', () => {
			DEFAULT_MONOREPO_MAPPINGS.forEach((mapping) => {
				expect(mapping.patterns.length).toBeGreaterThan(0);
			});
		});
	});

	describe('createDefaultProjectMapper', () => {
		it('should create mapper with default mappings', () => {
			const mapper = createDefaultProjectMapper();

			expect(mapper).toBeInstanceOf(ProjectMapper);
		});

		it('should use provided default project', () => {
			const mapper = createDefaultProjectMapper('Custom');

			const assignment = mapper.assignProject(['non-matching.txt']);

			expect(assignment.project).toBe('Custom');
			expect(assignment.isDefault).toBe(true);
		});

		it('should assign web files to Web App', () => {
			const mapper = createDefaultProjectMapper();

			const assignment = mapper.assignProject(['apps/web/src/Home.tsx']);

			expect(assignment.project).toBe('Web App');
		});

		it('should assign admin files to Admin Dashboard', () => {
			const mapper = createDefaultProjectMapper();

			const assignment = mapper.assignProject(['apps/admin/src/Dashboard.tsx']);

			expect(assignment.project).toBe('Admin Dashboard');
		});

		it('should assign API files to API', () => {
			const mapper = createDefaultProjectMapper();

			const assignment = mapper.assignProject(['apps/api/src/routes.ts']);

			expect(assignment.project).toBe('API');
		});

		it('should assign db files to Database', () => {
			const mapper = createDefaultProjectMapper();

			const assignment = mapper.assignProject([
				'packages/db/src/models/user.model.ts'
			]);

			expect(assignment.project).toBe('Database');
		});

		it('should assign test files to Testing', () => {
			const mapper = createDefaultProjectMapper();

			const assignment = mapper.assignProject(['src/user.test.ts']);

			expect(assignment.project).toBe('Testing');
		});

		it('should assign markdown to Documentation', () => {
			const mapper = createDefaultProjectMapper();

			const assignment = mapper.assignProject(['README.md']);

			expect(assignment.project).toBe('Documentation');
		});

		it('should assign config files to Infrastructure', () => {
			const mapper = createDefaultProjectMapper();

			const assignment = mapper.assignProject(['package.json']);

			expect(assignment.project).toBe('Infrastructure');
		});
	});

	describe('assignProjectToFiles', () => {
		it('should assign project using default mappings', () => {
			const assignment = assignProjectToFiles(['apps/api/src/routes.ts']);

			expect(assignment.project).toBe('API');
		});

		it('should use custom default project', () => {
			const assignment = assignProjectToFiles(
				['non-matching.txt'],
				'CustomDefault'
			);

			expect(assignment.project).toBe('CustomDefault');
		});

		it('should handle multiple files', () => {
			const assignment = assignProjectToFiles([
				'apps/web/src/Home.tsx',
				'apps/web/src/Button.tsx'
			]);

			expect(assignment.project).toBe('Web App');
		});

		it('should handle empty file list', () => {
			const assignment = assignProjectToFiles([]);

			// Should return first mapping as fallback
			expect(assignment.project).toBeDefined();
		});
	});
});
