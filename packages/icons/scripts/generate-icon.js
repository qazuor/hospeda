#!/usr/bin/env node

/**
 * Icon Generator Script
 *
 * Usage: node scripts/generate-icon.js <icon-name> [category]
 * Example: node scripts/generate-icon.js whatsapp social
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lucide icons mapping - you can extend this with more icons
const LUCIDE_ICONS = {
    // Social & Communication
    whatsapp: 'MessageCircle',
    instagram: 'Instagram',
    chat: 'MessageSquare',
    phone: 'Phone',
    web: 'Globe',
    language: 'Languages',
    contacto: 'Contact',
    contact: 'Contact',

    // Actions
    copy: 'Copy',
    clipboard: 'Clipboard',
    'ask-to-ai': 'Bot',
    ai: 'Bot',
    faqs: 'HelpCircle',
    help: 'HelpCircle',

    // Location & Map
    map: 'Map',
    location: 'MapPin',
    address: 'MapPin',

    // People
    huesped: 'User',
    huespedes: 'Users',
    guest: 'User',
    guests: 'Users',

    // Common
    home: 'Home',
    star: 'Star',
    heart: 'Heart',
    search: 'Search',
    menu: 'Menu',
    close: 'X',
    add: 'Plus',
    edit: 'Edit',
    delete: 'Trash2',
    settings: 'Settings',
    user: 'User',
    users: 'Users',
    calendar: 'Calendar',
    clock: 'Clock',
    mail: 'Mail',
    lock: 'Lock',
    unlock: 'Unlock',
    eye: 'Eye',
    'eye-off': 'EyeOff',
    check: 'Check',
    x: 'X',
    'arrow-left': 'ArrowLeft',
    'arrow-right': 'ArrowRight',
    'arrow-up': 'ArrowUp',
    'arrow-down': 'ArrowDown',
    'chevron-left': 'ChevronLeft',
    'chevron-right': 'ChevronRight',
    'chevron-up': 'ChevronUp',
    'chevron-down': 'ChevronDown'
};

// Categories mapping
const CATEGORIES = {
    social: 'social',
    communication: 'communication',
    system: 'system',
    admin: 'admin',
    entities: 'entities',
    amenities: 'amenities',
    features: 'features',
    attractions: 'attractions',
    actions: 'actions',
    navigation: 'navigation',
    ui: 'system'
};

/**
 * Converts kebab-case to PascalCase
 */
function toPascalCase(str) {
    return str
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

/**
 * Gets SVG content from Lucide React source or creates a placeholder
 */
async function getSvgContent(iconName) {
    const lucideName = LUCIDE_ICONS[iconName.toLowerCase()];

    if (lucideName) {
        // Try to fetch from Lucide's GitHub repository
        try {
            const response = await fetch(
                `https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/${lucideName
                    .toLowerCase()
                    .replace(/([A-Z])/g, '-$1')
                    .slice(1)}.svg`
            );
            if (response.ok) {
                const svgContent = await response.text();
                // Extract path data from SVG
                const pathMatch = svgContent.match(/<path[^>]*d="([^"]*)"[^>]*>/g);
                const circleMatch = svgContent.match(/<circle[^>]*>/g);
                const rectMatch = svgContent.match(/<rect[^>]*>/g);
                const lineMatch = svgContent.match(/<line[^>]*>/g);
                const polylineMatch = svgContent.match(/<polyline[^>]*>/g);

                let paths = '';
                if (pathMatch) paths += pathMatch.join('\n    ');
                if (circleMatch) paths += `\n    ${circleMatch.join('\n    ')}`;
                if (rectMatch) paths += `\n    ${rectMatch.join('\n    ')}`;
                if (lineMatch) paths += `\n    ${lineMatch.join('\n    ')}`;
                if (polylineMatch) paths += `\n    ${polylineMatch.join('\n    ')}`;

                return paths.trim();
            }
        } catch (_error) {
            console.warn(`Could not fetch SVG for ${iconName}, using placeholder`);
        }
    }

    // Fallback placeholder SVG
    return `<circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />`;
}

/**
 * Generates the icon component file
 */
function generateIconComponent(iconName, _category, svgContent) {
    const componentName = `${toPascalCase(iconName)}Icon`;

    return `import type { IconProps } from '../../types';
import { ICON_SIZES } from '../../types';

/**
 * ${componentName} component
 *
 * @example
 * \`\`\`tsx
 * import { ${componentName} } from '@repo/icons';
 *
 * // Basic usage
 * <${componentName} />
 *
 * // With custom size and color
 * <${componentName} size="lg" color="#3B82F6" />
 *
 * // With Tailwind classes
 * <${componentName} className="text-blue-500 hover:text-blue-600" />
 * \`\`\`
 */
export const ${componentName} = ({
    size = 'md',
    color = 'currentColor',
    className = '',
    'aria-label': ariaLabel,
    ...props
}: IconProps) => (
    <svg
        width={typeof size === 'string' ? ICON_SIZES[size] : size}
        height={typeof size === 'string' ? ICON_SIZES[size] : size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-label={ariaLabel || '${iconName} icon'}
        {...props}
    >
        <title>{ariaLabel || '${iconName}'}</title>
        ${svgContent}
    </svg>
);`;
}

/**
 * Updates the main index.ts file with the new export
 */
function updateIndexFile(iconName, category) {
    const indexPath = join(__dirname, '../src/index.ts');
    const componentName = `${toPascalCase(iconName)}Icon`;
    const importPath = `./icons/${category}/${componentName}`;

    let content = readFileSync(indexPath, 'utf-8');

    // Find the right section to add the export
    const categoryComment = `// Export ${category} icons`;
    const exportLine = `export { ${componentName} } from '${importPath}';`;

    if (content.includes(categoryComment)) {
        // Add to existing category
        const lines = content.split('\n');
        const categoryIndex = lines.findIndex((line) => line.includes(categoryComment));

        // Find the end of this category section
        let insertIndex = categoryIndex + 1;
        while (insertIndex < lines.length && lines[insertIndex].startsWith('export {')) {
            insertIndex++;
        }

        lines.splice(insertIndex, 0, exportLine);
        content = lines.join('\n');
    } else {
        // Add new category section
        content += `\n// Export ${category} icons\n${exportLine}\n`;
    }

    writeFileSync(indexPath, content);
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Usage: node scripts/generate-icon.js <icon-name> [category]');
        console.error('Example: node scripts/generate-icon.js whatsapp social');
        process.exit(1);
    }

    const iconName = args[0].toLowerCase();
    const category = CATEGORIES[args[1]?.toLowerCase()] || 'system';

    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log(`Generating ${iconName} icon in ${category} category...`);

    // Create category directory if it doesn't exist
    const categoryDir = join(__dirname, '../src/icons', category);
    if (!existsSync(categoryDir)) {
        mkdirSync(categoryDir, { recursive: true });
    }

    // Get SVG content
    const svgContent = await getSvgContent(iconName);

    // Generate component
    const componentName = `${toPascalCase(iconName)}Icon`;
    const componentContent = generateIconComponent(iconName, category, svgContent);

    // Write component file
    const componentPath = join(categoryDir, `${componentName}.tsx`);
    writeFileSync(componentPath, componentContent);

    // Update index.ts
    updateIndexFile(iconName, category);

    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log(`✅ Generated ${componentName} at ${componentPath}`);
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log('✅ Updated index.ts with export');
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log('\nUsage:');
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log(`import { ${componentName} } from '@repo/icons';`);
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log(`<${componentName} size="md" className="text-blue-500" />`);
}

main().catch(console.error);
