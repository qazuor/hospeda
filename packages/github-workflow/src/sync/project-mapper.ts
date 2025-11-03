/**
 * Project assignment based on file paths
 *
 * Maps file paths to GitHub projects for automatic issue assignment.
 * Supports flexible configuration and pattern matching.
 *
 * @module sync/project-mapper
 */

/**
 * Project mapping configuration
 */
export type ProjectMapping = {
    /** Project name in GitHub */
    name: string;

    /** Project ID in GitHub (optional) */
    id?: string;

    /** File path patterns (glob-style) */
    patterns: string[];

    /** Description */
    description?: string;

    /** Priority (higher = checked first) */
    priority?: number;
};

/**
 * Project mapper options
 */
export type ProjectMapperOptions = {
    /** Project mappings */
    mappings: ProjectMapping[];

    /** Default project if no match found */
    defaultProject?: string;

    /** Case sensitive matching */
    caseSensitive?: boolean;
};

/**
 * Project assignment result
 */
export type ProjectAssignment = {
    /** Assigned project name */
    project: string;

    /** Project ID (if available) */
    projectId?: string;

    /** Matched pattern */
    matchedPattern?: string;

    /** Confidence level (0-1) */
    confidence: number;

    /** Whether this is the default project */
    isDefault: boolean;
};

/**
 * Project mapper for automatic assignment
 *
 * Maps file paths to GitHub projects using configurable patterns.
 * Supports glob-style patterns and priority-based matching.
 *
 * @example
 * ```typescript
 * const mapper = new ProjectMapper({
 *   mappings: [
 *     {
 *       name: 'Web App',
 *       patterns: ['apps/web/**', 'packages/ui/**'],
 *       priority: 10
 *     },
 *     {
 *       name: 'API',
 *       patterns: ['apps/api/**', 'packages/service-core/**'],
 *       priority: 10
 *     },
 *     {
 *       name: 'Database',
 *       patterns: ['packages/db/**'],
 *       priority: 5
 *     }
 *   ],
 *   defaultProject: 'General'
 * });
 *
 * const assignment = mapper.assignProject(['apps/web/src/pages/Home.tsx']);
 * // Returns: { project: 'Web App', matchedPattern: 'apps/web/**', confidence: 1, isDefault: false }
 * ```
 */
export class ProjectMapper {
    private readonly mappings: ProjectMapping[];
    private readonly defaultProject?: string;
    private readonly caseSensitive: boolean;

    constructor(options: ProjectMapperOptions) {
        // Sort mappings by priority (highest first)
        this.mappings = [...options.mappings].sort((a, b) => {
            const priorityA = a.priority ?? 0;
            const priorityB = b.priority ?? 0;
            return priorityB - priorityA;
        });

        this.defaultProject = options.defaultProject;
        this.caseSensitive = options.caseSensitive ?? false;
    }

    /**
     * Assign project based on file paths
     *
     * Takes a list of file paths and determines which project they belong to.
     * Returns the first matching project based on priority.
     *
     * @param filePaths - Array of file paths to analyze
     * @returns Project assignment result
     *
     * @example
     * ```typescript
     * const assignment = mapper.assignProject([
     *   'apps/web/src/pages/Home.tsx',
     *   'apps/web/src/components/Button.tsx'
     * ]);
     * // Returns: { project: 'Web App', ... }
     * ```
     */
    assignProject(filePaths: string[]): ProjectAssignment {
        // Normalize paths for comparison
        const normalizedPaths = this.caseSensitive
            ? filePaths
            : filePaths.map((p) => p.toLowerCase());

        // Try each mapping in priority order
        for (const mapping of this.mappings) {
            for (const pattern of mapping.patterns) {
                const normalizedPattern = this.caseSensitive ? pattern : pattern.toLowerCase();

                // Check if any path matches this pattern
                const matchedPath = normalizedPaths.find((path) =>
                    this.matchesPattern(path, normalizedPattern)
                );

                if (matchedPath) {
                    return {
                        project: mapping.name,
                        projectId: mapping.id,
                        matchedPattern: pattern,
                        confidence: 1.0,
                        isDefault: false
                    };
                }
            }
        }

        // No match found, use default project
        if (this.defaultProject) {
            return {
                project: this.defaultProject,
                confidence: 0.5,
                isDefault: true
            };
        }

        // No default, return first mapping as fallback
        const fallback = this.mappings[0];
        return {
            project: fallback?.name ?? 'Unassigned',
            projectId: fallback?.id,
            confidence: 0.0,
            isDefault: false
        };
    }

    /**
     * Assign projects to multiple file paths with grouping
     *
     * Analyzes file paths and groups them by project.
     * Useful for assigning multi-file changes to appropriate projects.
     *
     * @param filePaths - Array of file paths
     * @returns Map of project names to file paths
     *
     * @example
     * ```typescript
     * const grouped = mapper.groupByProject([
     *   'apps/web/src/Home.tsx',
     *   'apps/api/src/routes.ts',
     *   'apps/web/src/Button.tsx'
     * ]);
     * // Returns: Map {
     * //   'Web App' => ['apps/web/src/Home.tsx', 'apps/web/src/Button.tsx'],
     * //   'API' => ['apps/api/src/routes.ts']
     * // }
     * ```
     */
    groupByProject(filePaths: string[]): Map<string, string[]> {
        const groups = new Map<string, string[]>();

        for (const path of filePaths) {
            const assignment = this.assignProject([path]);
            const existing = groups.get(assignment.project) ?? [];
            groups.set(assignment.project, [...existing, path]);
        }

        return groups;
    }

    /**
     * Get all configured projects
     *
     * Returns list of all projects that can be assigned.
     *
     * @returns Array of project names
     */
    getProjects(): string[] {
        const projects = this.mappings.map((m) => m.name);

        if (this.defaultProject && !projects.includes(this.defaultProject)) {
            projects.push(this.defaultProject);
        }

        return projects;
    }

    /**
     * Get mapping details for a project
     *
     * @param projectName - Project name
     * @returns Project mapping or undefined
     */
    getMapping(projectName: string): ProjectMapping | undefined {
        return this.mappings.find((m) => m.name === projectName);
    }

    /**
     * Match path against pattern
     *
     * Supports glob-style patterns:
     * - `*` matches any characters within a path segment
     * - `**` matches any number of path segments
     * - Exact matches
     *
     * @param path - File path to test
     * @param pattern - Pattern to match against
     * @returns True if path matches pattern
     *
     * @private
     */
    private matchesPattern(path: string, pattern: string): boolean {
        // Exact match
        if (path === pattern) {
            return true;
        }

        // Convert glob pattern to regex
        const regex = this.globToRegex(pattern);
        return regex.test(path);
    }

    /**
     * Convert glob pattern to regex
     *
     * @param pattern - Glob pattern
     * @returns Regular expression
     *
     * @private
     */
    private globToRegex(pattern: string): RegExp {
        // Escape special regex characters except * and /
        let regex = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

        // Replace ** with a placeholder first to avoid conflicts
        regex = regex.replace(/\*\*/g, '__GLOBSTAR__');

        // Replace * with regex for within segment
        regex = regex.replace(/\*/g, '[^/]*');

        // Replace placeholder with regex for any path segments
        regex = regex.replace(/__GLOBSTAR__/g, '.*');

        // Anchor to start and end
        regex = `^${regex}$`;

        return new RegExp(regex);
    }
}

/**
 * Default project mappings for monorepo structure
 */
export const DEFAULT_MONOREPO_MAPPINGS: ProjectMapping[] = [
    {
        name: 'Web App',
        patterns: ['apps/web/**/*', 'packages/ui/**/*', 'packages/auth-ui/**/*'],
        description: 'Public web application (Astro + React)',
        priority: 10
    },
    {
        name: 'Admin Dashboard',
        patterns: ['apps/admin/**/*'],
        description: 'Admin dashboard (TanStack Start)',
        priority: 10
    },
    {
        name: 'API',
        patterns: ['apps/api/**/*', 'packages/service-core/**/*'],
        description: 'Backend API (Hono)',
        priority: 10
    },
    {
        name: 'Database',
        patterns: ['packages/db/**/*'],
        description: 'Database models and migrations (Drizzle)',
        priority: 9
    },
    {
        name: 'Schemas',
        patterns: ['packages/schemas/**/*'],
        description: 'Shared validation schemas (Zod)',
        priority: 8
    },
    {
        name: 'Payments',
        patterns: ['packages/payments/**/*'],
        description: 'Payment processing (Mercado Pago)',
        priority: 7
    },
    {
        name: 'Infrastructure',
        patterns: [
            'packages/utils/**/*',
            'packages/logger/**/*',
            'packages/config/**/*',
            '.github/**/*',
            '*.config.*',
            'turbo.json',
            'package.json',
            'pnpm-workspace.yaml'
        ],
        description: 'Shared utilities and infrastructure',
        priority: 5
    },
    {
        name: 'Documentation',
        patterns: ['docs/**/*', '**/*.md', '*.md', '.claude/**/*'],
        description: 'Documentation and guides',
        priority: 4
    },
    {
        name: 'Testing',
        patterns: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*'],
        description: 'Test files and testing infrastructure',
        priority: 3
    }
];

/**
 * Create project mapper with default monorepo mappings
 *
 * @param defaultProject - Default project for unmatched files
 * @returns Configured ProjectMapper instance
 *
 * @example
 * ```typescript
 * const mapper = createDefaultProjectMapper('General');
 * const assignment = mapper.assignProject(['apps/web/src/Home.tsx']);
 * ```
 */
export function createDefaultProjectMapper(defaultProject = 'General'): ProjectMapper {
    return new ProjectMapper({
        mappings: DEFAULT_MONOREPO_MAPPINGS,
        defaultProject,
        caseSensitive: false
    });
}

/**
 * Assign project to file paths using default mappings
 *
 * Convenience function for quick project assignment.
 *
 * @param filePaths - File paths to analyze
 * @param defaultProject - Default project for unmatched files
 * @returns Project assignment result
 *
 * @example
 * ```typescript
 * const assignment = assignProjectToFiles(['apps/api/src/routes.ts']);
 * // Returns: { project: 'API', ... }
 * ```
 */
export function assignProjectToFiles(
    filePaths: string[],
    defaultProject?: string
): ProjectAssignment {
    const mapper = createDefaultProjectMapper(defaultProject);
    return mapper.assignProject(filePaths);
}
