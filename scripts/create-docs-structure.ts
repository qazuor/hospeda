#!/usr/bin/env tsx

/**
 * Script to create the documentation folder structure
 *
 * This script creates the complete folder structure for the Hospeda documentation
 * as defined in the UX-Navigation-Structure.md
 *
 * Usage:
 *   tsx scripts/create-docs-structure.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

interface FolderStructure {
    path: string;
    readmeTitle: string;
    description: string;
}

/**
 * Create a folder and its README.md file
 *
 * @param input - Input parameters
 * @param input.folderPath - Path to the folder to create
 * @param input.readmeTitle - Title for the README.md
 * @param input.description - Description for the README.md
 */
function createFolderWithReadme(input: {
    folderPath: string;
    readmeTitle: string;
    description: string;
}): void {
    const { folderPath, readmeTitle, description } = input;

    // Create folder if it doesn't exist
    if (fs.existsSync(folderPath)) {
    } else {
        fs.mkdirSync(folderPath, { recursive: true });
    }

    // Create README.md
    const readmePath = path.join(folderPath, 'README.md');
    const readmeContent = `# ${readmeTitle}\n\n${description}\n\n---\n\n*This section is under construction.*\n`;

    if (fs.existsSync(readmePath)) {
    } else {
        fs.writeFileSync(readmePath, readmeContent, 'utf-8');
    }
}

/**
 * Main function to create the documentation structure
 */
async function main(): Promise<void> {
    const projectRoot = process.cwd();

    // Define the folder structure
    const folders: FolderStructure[] = [
        // Central Documentation - docs/
        {
            path: 'docs',
            readmeTitle: 'Hospeda Documentation',
            description: 'Welcome to the Hospeda monorepo documentation!'
        },
        {
            path: 'docs/getting-started',
            readmeTitle: 'Getting Started',
            description: 'Documentation about getting started with Hospeda.'
        },
        {
            path: 'docs/architecture',
            readmeTitle: 'Architecture',
            description: 'Documentation about Hospeda system architecture.'
        },
        {
            path: 'docs/guides',
            readmeTitle: 'Guides',
            description: 'Cross-cutting tutorials and guides.'
        },
        {
            path: 'docs/deployment',
            readmeTitle: 'Deployment',
            description: 'Documentation about deploying Hospeda.'
        },
        {
            path: 'docs/contributing',
            readmeTitle: 'Contributing',
            description: 'Guidelines for contributing to Hospeda.'
        },
        {
            path: 'docs/claude-code',
            readmeTitle: 'Claude Code',
            description: 'AI-assisted development with Claude Code.'
        },
        {
            path: 'docs/runbooks',
            readmeTitle: 'Runbooks',
            description: 'Operational procedures and runbooks.'
        },
        {
            path: 'docs/security',
            readmeTitle: 'Security',
            description: 'Security best practices and guidelines.'
        },
        {
            path: 'docs/performance',
            readmeTitle: 'Performance',
            description: 'Performance optimization guides.'
        },
        {
            path: 'docs/testing',
            readmeTitle: 'Testing',
            description: 'Testing strategies and guides.'
        },
        {
            path: 'docs/resources',
            readmeTitle: 'Resources',
            description: 'Additional resources and references.'
        },
        {
            path: 'docs/diagrams',
            readmeTitle: 'Diagrams',
            description: 'Visual diagrams and architecture illustrations.'
        },
        {
            path: 'docs/examples',
            readmeTitle: 'Examples',
            description: 'Code examples and tutorials.'
        },
        {
            path: 'docs/examples/basic-crud',
            readmeTitle: 'Basic CRUD Example',
            description: 'Simple CRUD operation example.'
        },
        {
            path: 'docs/examples/advanced-service',
            readmeTitle: 'Advanced Service Example',
            description: 'Complex service implementation example.'
        },
        {
            path: 'docs/examples/custom-validation',
            readmeTitle: 'Custom Validation Example',
            description: 'Custom validator implementation example.'
        },
        {
            path: 'docs/examples/testing-patterns',
            readmeTitle: 'Testing Patterns Example',
            description: 'Test pattern examples.'
        },

        // Apps Documentation
        // API
        {
            path: 'apps/api/docs',
            readmeTitle: 'API Documentation',
            description: 'Documentation for the Hono backend API.'
        },
        {
            path: 'apps/api/docs/usage',
            readmeTitle: 'API Usage',
            description: 'Documentation for API consumers.'
        },
        {
            path: 'apps/api/docs/development',
            readmeTitle: 'API Development',
            description: 'Documentation for API developers.'
        },
        {
            path: 'apps/api/docs/examples',
            readmeTitle: 'API Examples',
            description: 'API code examples.'
        },

        // Web
        {
            path: 'apps/web/docs',
            readmeTitle: 'Web Documentation',
            description: 'Documentation for the Astro + React web app.'
        },
        {
            path: 'apps/web/docs/usage',
            readmeTitle: 'Web Usage',
            description: 'Documentation for web app features.'
        },
        {
            path: 'apps/web/docs/development',
            readmeTitle: 'Web Development',
            description: 'Documentation for web app developers.'
        },
        {
            path: 'apps/web/docs/examples',
            readmeTitle: 'Web Examples',
            description: 'Web app code examples.'
        },

        // Admin
        {
            path: 'apps/admin/docs',
            readmeTitle: 'Admin Documentation',
            description: 'Documentation for the TanStack Start admin dashboard.'
        },
        {
            path: 'apps/admin/docs/usage',
            readmeTitle: 'Admin Usage',
            description: 'Documentation for admin features.'
        },
        {
            path: 'apps/admin/docs/development',
            readmeTitle: 'Admin Development',
            description: 'Documentation for admin developers.'
        },
        {
            path: 'apps/admin/docs/examples',
            readmeTitle: 'Admin Examples',
            description: 'Admin app code examples.'
        },

        // Packages Documentation - Core Packages (SUPER DETAILED)
        // service-core
        {
            path: 'packages/service-core/docs',
            readmeTitle: '@repo/service-core',
            description: 'Documentation for the service-core package.'
        },
        {
            path: 'packages/service-core/docs/api',
            readmeTitle: 'Service Core API',
            description: 'API reference for service-core.'
        },
        {
            path: 'packages/service-core/docs/guides',
            readmeTitle: 'Service Core Guides',
            description: 'Guides for using service-core.'
        },
        {
            path: 'packages/service-core/docs/examples',
            readmeTitle: 'Service Core Examples',
            description: 'Code examples for service-core.'
        },

        // db
        {
            path: 'packages/db/docs',
            readmeTitle: '@repo/db',
            description: 'Documentation for the db package.'
        },
        {
            path: 'packages/db/docs/api',
            readmeTitle: 'DB API',
            description: 'API reference for db package.'
        },
        {
            path: 'packages/db/docs/guides',
            readmeTitle: 'DB Guides',
            description: 'Guides for using db package.'
        },
        {
            path: 'packages/db/docs/examples',
            readmeTitle: 'DB Examples',
            description: 'Code examples for db package.'
        },

        // schemas
        {
            path: 'packages/schemas/docs',
            readmeTitle: '@repo/schemas',
            description: 'Documentation for the schemas package.'
        },
        {
            path: 'packages/schemas/docs/api',
            readmeTitle: 'Schemas API',
            description: 'API reference for schemas package.'
        },
        {
            path: 'packages/schemas/docs/guides',
            readmeTitle: 'Schemas Guides',
            description: 'Guides for using schemas package.'
        },
        {
            path: 'packages/schemas/docs/examples',
            readmeTitle: 'Schemas Examples',
            description: 'Code examples for schemas package.'
        },

        // config
        {
            path: 'packages/config/docs',
            readmeTitle: '@repo/config',
            description: 'Documentation for the config package.'
        },
        {
            path: 'packages/config/docs/api',
            readmeTitle: 'Config API',
            description: 'API reference for config package.'
        },
        {
            path: 'packages/config/docs/guides',
            readmeTitle: 'Config Guides',
            description: 'Guides for using config package.'
        },
        {
            path: 'packages/config/docs/examples',
            readmeTitle: 'Config Examples',
            description: 'Code examples for config package.'
        },

        // logger
        {
            path: 'packages/logger/docs',
            readmeTitle: '@repo/logger',
            description: 'Documentation for the logger package.'
        },
        {
            path: 'packages/logger/docs/api',
            readmeTitle: 'Logger API',
            description: 'API reference for logger package.'
        },
        {
            path: 'packages/logger/docs/guides',
            readmeTitle: 'Logger Guides',
            description: 'Guides for using logger package.'
        },
        {
            path: 'packages/logger/docs/examples',
            readmeTitle: 'Logger Examples',
            description: 'Code examples for logger package.'
        },

        // icons
        {
            path: 'packages/icons/docs',
            readmeTitle: '@repo/icons',
            description: 'Documentation for the icons package.'
        },
        {
            path: 'packages/icons/docs/api',
            readmeTitle: 'Icons API',
            description: 'API reference for icons package.'
        },
        {
            path: 'packages/icons/docs/guides',
            readmeTitle: 'Icons Guides',
            description: 'Guides for using icons package.'
        },
        {
            path: 'packages/icons/docs/examples',
            readmeTitle: 'Icons Examples',
            description: 'Code examples for icons package.'
        },

        // seed
        {
            path: 'packages/seed/docs',
            readmeTitle: '@repo/seed',
            description: 'Documentation for the seed package.'
        },
        {
            path: 'packages/seed/docs/api',
            readmeTitle: 'Seed API',
            description: 'API reference for seed package.'
        },
        {
            path: 'packages/seed/docs/guides',
            readmeTitle: 'Seed Guides',
            description: 'Guides for using seed package.'
        },
        {
            path: 'packages/seed/docs/examples',
            readmeTitle: 'Seed Examples',
            description: 'Code examples for seed package.'
        }
    ];

    // Create each folder and README
    for (const folder of folders) {
        const fullPath = path.join(projectRoot, folder.path);
        createFolderWithReadme({
            folderPath: fullPath,
            readmeTitle: folder.readmeTitle,
            description: folder.description
        });
    }
}

main().catch((error: Error) => {
    console.error('❌ Error creating documentation structure:', error.message);
    process.exit(1);
});
