/**
 * Tests for template engine
 *
 * @module test/enrichment/template-engine
 */

import { describe, it, expect } from 'vitest';
import { generateIssueTemplate, type PlanningContext } from '../../src/enrichment/template-engine.js';

describe('generateIssueTemplate', () => {
	const mockContext: PlanningContext = {
		sessionId: 'P-001',
		title: 'User Authentication System',
		goals: [
			'Enable secure user registration',
			'Implement role-based access control',
			'Integrate with Clerk authentication service'
		],
		userStories: [
			{
				role: 'guest user',
				action: 'register for an account',
				benefit: 'I can book accommodations'
			}
		],
		acceptanceCriteria: [
			'User registration flow works',
			'Email verification is enforced',
			'Role-based access control is implemented'
		],
		architecture: 'The authentication system follows a layered architecture.',
		dependencies: ['Clerk', 'JWT', 'Redis'],
		risks: ['Clerk service downtime', 'Rate limiting too strict'],
		tasks: [
			{
				id: 'T-001-001',
				title: 'Create database schema',
				description: 'Design and implement database tables',
				estimate: '8h'
			}
		]
	};

	describe('feature templates', () => {
		it('should generate feature template with all context', () => {
			// Arrange & Act
			const result = generateIssueTemplate({
				type: 'feature',
				context: mockContext
			});

			// Assert
			expect(result.success).toBe(true);
			expect(result.template).toBeDefined();
			expect(result.template?.title).toContain('User Authentication System');
			expect(result.template?.body).toContain('P-001');
			expect(result.template?.body).toContain('Goals');
			expect(result.template?.body).toContain('User Stories');
			expect(result.template?.body).toContain('Acceptance Criteria');
			expect(result.template?.labels).toContain('feature');
		});

		it('should include all goals in template', () => {
			// Arrange & Act
			const result = generateIssueTemplate({
				type: 'feature',
				context: mockContext
			});

			// Assert
			expect(result.template?.body).toContain('Enable secure user registration');
			expect(result.template?.body).toContain('role-based access control');
		});

		it('should include user stories in template', () => {
			// Arrange & Act
			const result = generateIssueTemplate({
				type: 'feature',
				context: mockContext
			});

			// Assert
			expect(result.template?.body).toContain('guest user');
			expect(result.template?.body).toContain('register for an account');
			expect(result.template?.body).toContain('book accommodations');
		});
	});

	describe('task templates', () => {
		it('should generate task template with task-specific info', () => {
			// Arrange & Act
			const result = generateIssueTemplate({
				type: 'task',
				context: mockContext,
				taskCode: 'T-001-001'
			});

			// Assert
			expect(result.success).toBe(true);
			expect(result.template?.title).toContain('Create database schema');
			expect(result.template?.body).toContain('T-001-001');
			expect(result.template?.body).toContain('8h');
			expect(result.template?.labels).toContain('task');
		});

		it('should fail if task code not found', () => {
			// Arrange & Act
			const result = generateIssueTemplate({
				type: 'task',
				context: mockContext,
				taskCode: 'T-999-999'
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toContain('not found');
		});

		it('should fail if task code not provided for task type', () => {
			// Arrange & Act
			const result = generateIssueTemplate({
				type: 'task',
				context: mockContext
			});

			// Assert
			expect(result.success).toBe(false);
			expect(result.error).toContain('required');
		});
	});

	describe('markdown formatting', () => {
		it('should format template as valid markdown', () => {
			// Arrange & Act
			const result = generateIssueTemplate({
				type: 'feature',
				context: mockContext
			});

			// Assert
			const body = result.template?.body ?? '';
			expect(body).toMatch(/^#/m); // Has headings
			expect(body).toMatch(/^-/m); // Has bullet points
			expect(body).toContain('**'); // Has bold text
		});

		it('should include session link', () => {
			// Arrange & Act
			const result = generateIssueTemplate({
				type: 'feature',
				context: mockContext,
				sessionPath: '.claude/sessions/planning/P-001-auth'
			});

			// Assert
			expect(result.template?.body).toContain('P-001');
			expect(result.template?.body).toContain('.claude/sessions/planning');
		});
	});

	describe('error handling', () => {
		it('should handle missing context fields gracefully', () => {
			// Arrange
			const minimalContext: PlanningContext = {
				sessionId: 'P-001',
				title: 'Test Feature'
			};

			// Act
			const result = generateIssueTemplate({
				type: 'feature',
				context: minimalContext
			});

			// Assert
			expect(result.success).toBe(true);
			expect(result.template?.title).toBe('Test Feature');
		});
	});
});
