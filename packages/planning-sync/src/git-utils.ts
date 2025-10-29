/**
 * Git Utilities
 * Helpers for analyzing git status and suggesting commits
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Represents a changed file in git
 */
export interface GitChangedFile {
    /** File path relative to repo root */
    path: string;
    /** Status: 'M' (modified), 'A' (added), 'D' (deleted), '??' (untracked) */
    status: string;
    /** Whether file is staged */
    staged: boolean;
}

/**
 * Represents a suggested commit
 */
export interface CommitSuggestion {
    /** Commit message (first line) */
    message: string;
    /** Commit body (additional lines) */
    body?: string;
    /** Files to include in this commit */
    files: string[];
    /** Git add command */
    addCommand: string;
    /** Git commit command */
    commitCommand: string;
}

/**
 * Gets list of changed files from git status
 *
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns Array of changed files
 */
export async function getChangedFiles(cwd: string = process.cwd()): Promise<GitChangedFile[]> {
    try {
        const { stdout } = await execAsync('git status --short', { cwd });

        return stdout
            .trim()
            .split('\n')
            .filter((line) => line.trim() !== '' && line.length >= 3)
            .map((line) => {
                const staged = line[0] !== ' ' && line[0] !== '?';
                const status = (staged ? line[0] : line[1]) || '';
                const path = line.substring(3).trim();

                return {
                    path,
                    status,
                    staged
                };
            });
    } catch (_error) {
        // If git status fails, return empty array
        return [];
    }
}

/**
 * Analyzes changed files and suggests logical commit groupings
 *
 * @param files - Changed files from git status
 * @param taskTitle - Title of completed task for context
 * @returns Array of commit suggestions
 */
export function suggestCommits(files: GitChangedFile[], taskTitle: string): CommitSuggestion[] {
    const suggestions: CommitSuggestion[] = [];

    // Group files by package/module
    const filesByPackage = groupFilesByPackage(files);

    // Generate commits for each package
    for (const [packageName, packageFiles] of Object.entries(filesByPackage)) {
        // Separate by file type within package
        const schemaFiles = packageFiles.filter((f) => f.path.includes('schemas'));
        const modelFiles = packageFiles.filter((f) => f.path.includes('models'));
        const serviceFiles = packageFiles.filter((f) => f.path.includes('services'));
        const apiFiles = packageFiles.filter((f) => f.path.includes('routes'));
        const testFiles = packageFiles.filter((f) => f.path.includes('test'));
        const otherFiles = packageFiles.filter(
            (f) =>
                !schemaFiles.includes(f) &&
                !modelFiles.includes(f) &&
                !serviceFiles.includes(f) &&
                !apiFiles.includes(f) &&
                !testFiles.includes(f)
        );

        // Schema changes
        if (schemaFiles.length > 0) {
            suggestions.push(createCommitSuggestion('schemas', schemaFiles, taskTitle));
        }

        // Model changes (include tests with model)
        if (modelFiles.length > 0) {
            const modelTestFiles = testFiles.filter((f) =>
                modelFiles.some((m) =>
                    f.path.includes(m.path.split('/').pop()?.replace('.ts', '') || '')
                )
            );
            suggestions.push(
                createCommitSuggestion('db', [...modelFiles, ...modelTestFiles], taskTitle)
            );
        }

        // Service changes (include tests with service)
        if (serviceFiles.length > 0) {
            const serviceTestFiles = testFiles.filter((f) =>
                serviceFiles.some((s) =>
                    f.path.includes(s.path.split('/').pop()?.replace('.ts', '') || '')
                )
            );
            suggestions.push(
                createCommitSuggestion('service', [...serviceFiles, ...serviceTestFiles], taskTitle)
            );
        }

        // API changes
        if (apiFiles.length > 0) {
            suggestions.push(createCommitSuggestion('api', apiFiles, taskTitle));
        }

        // Other files
        if (otherFiles.length > 0) {
            suggestions.push(createCommitSuggestion(packageName, otherFiles, taskTitle));
        }
    }

    return suggestions;
}

/**
 * Groups files by package/module
 */
function groupFilesByPackage(files: GitChangedFile[]): Record<string, GitChangedFile[]> {
    const groups: Record<string, GitChangedFile[]> = {};

    for (const file of files) {
        // Extract package name from path
        const match = file.path.match(/^(packages|apps)\/([^/]+)/);
        const packageName: string = match?.[2] ?? 'root';

        if (!groups[packageName]) {
            groups[packageName] = [];
        }
        groups[packageName].push(file);
    }

    return groups;
}

/**
 * Creates a commit suggestion for a group of files
 */
function createCommitSuggestion(
    scope: string,
    files: GitChangedFile[],
    taskTitle: string
): CommitSuggestion {
    const filePaths = files.map((f) => f.path);

    // Determine commit type
    const hasNew = files.some((f) => f.status === 'A' || f.status === '?');
    const hasModified = files.some((f) => f.status === 'M');
    const hasDeleted = files.some((f) => f.status === 'D');

    let type = 'feat';
    if (!hasNew && hasModified) {
        type = 'refactor';
    }
    if (hasDeleted) {
        type = 'refactor';
    }

    // Generate message
    const message = `${type}(${scope}): ${generateShortDescription(files, taskTitle)}`;

    // Generate body
    const body = generateCommitBody(files, taskTitle);

    // Generate commands
    const addCommand = `git add ${filePaths.join(' ')}`;
    const commitCommand = `git commit -m "${message}\n\n${body}"`;

    return {
        message,
        body,
        files: filePaths,
        addCommand,
        commitCommand
    };
}

/**
 * Generates a short description for commit message
 */
function generateShortDescription(files: GitChangedFile[], taskTitle: string): string {
    // Try to extract action from task title
    const lowerTitle = taskTitle.toLowerCase();

    if (lowerTitle.includes('create') || lowerTitle.includes('add')) {
        if (lowerTitle.includes('model')) return 'add model implementation';
        if (lowerTitle.includes('schema')) return 'add validation schemas';
        if (lowerTitle.includes('service')) return 'add service layer';
        if (lowerTitle.includes('api') || lowerTitle.includes('route')) return 'add API routes';
        if (lowerTitle.includes('test')) return 'add tests';
        return 'add new implementation';
    }

    if (lowerTitle.includes('implement')) {
        if (lowerTitle.includes('model')) return 'implement model';
        if (lowerTitle.includes('service')) return 'implement service';
        if (lowerTitle.includes('api')) return 'implement API endpoints';
        return 'implement feature';
    }

    if (lowerTitle.includes('update') || lowerTitle.includes('modify')) {
        return 'update implementation';
    }

    if (lowerTitle.includes('test')) {
        return 'add test coverage';
    }

    // Default based on file types
    if (files.some((f) => f.path.includes('test'))) {
        return 'add tests';
    }

    return 'implement changes';
}

/**
 * Generates commit body with bullet points
 */
function generateCommitBody(files: GitChangedFile[], taskTitle: string): string {
    const bullets: string[] = [];

    // Describe what was done
    const hasTests = files.some((f) => f.path.includes('test'));
    const hasModels = files.some((f) => f.path.includes('model'));
    const hasSchemas = files.some((f) => f.path.includes('schema'));
    const hasServices = files.some((f) => f.path.includes('service'));
    const hasRoutes = files.some((f) => f.path.includes('route'));

    if (hasSchemas) {
        bullets.push('Add validation schemas with Zod');
    }
    if (hasModels) {
        bullets.push('Extend BaseModel for entity operations');
    }
    if (hasServices) {
        bullets.push('Implement service layer with business logic');
    }
    if (hasRoutes) {
        bullets.push('Create API routes with proper validation');
    }
    if (hasTests) {
        bullets.push('Include comprehensive test coverage');
    }

    // Add file references
    bullets.push(`\nRelated to: ${taskTitle}`);

    return bullets.map((b) => `- ${b}`).join('\n');
}
