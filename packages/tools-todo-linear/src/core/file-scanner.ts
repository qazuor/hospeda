/**
 * File scanner for finding TODO/HACK/DEBUG comments across the codebase
 */

import { glob } from 'glob';
import type { ParsedComment, TodoLinearConfig } from '../types/index.js';
import logger from '../utils/logger.js';
import { CommentParser } from './parser.js';

/**
 * Default file patterns to include and exclude
 */
const DEFAULT_INCLUDE_PATTERNS = [
    '**/*.{ts,tsx,js,jsx,vue,svelte,py,rb,php,java,c,cpp,h,hpp,cs,go,rs,swift,kt}'
];

const DEFAULT_EXCLUDE_PATTERNS = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/.git/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.bundle.js'
];

/**
 * Scans files for TODO/HACK/DEBUG comments
 */
export class FileScanner {
    private readonly parser: CommentParser;
    private readonly includePatterns: string[];
    private readonly excludePatterns: string[];
    private readonly projectRoot: string;

    constructor(config: TodoLinearConfig) {
        this.parser = new CommentParser(config.projectRoot);
        this.projectRoot = config.projectRoot;
        this.includePatterns =
            config.includePatterns.length > 0 ? config.includePatterns : DEFAULT_INCLUDE_PATTERNS;
        this.excludePatterns = [...DEFAULT_EXCLUDE_PATTERNS, ...config.excludePatterns];
    }

    /**
     * Scans all files in the project for TODO comments
     */
    async scanAllFiles(): Promise<ParsedComment[]> {
        const files = await this.findFiles();
        const allComments: ParsedComment[] = [];

        logger.progress(`🔍 Scanning ${files.length} files for TODO comments...`);

        for (const file of files) {
            try {
                const comments = this.parser.parseFile(file);
                allComments.push(...comments);
            } catch (error) {
                logger.warn(`Warning: Failed to parse file ${file}: ${error}`);
            }
        }

        logger.info(`📝 Found ${allComments.length} TODO comments in ${files.length} files`);
        return allComments;
    }

    /**
     * Finds all files matching the include/exclude patterns
     */
    private async findFiles(): Promise<string[]> {
        const allFiles: Set<string> = new Set();

        // Find files matching include patterns
        for (const pattern of this.includePatterns) {
            try {
                const files = await glob(pattern, {
                    cwd: this.projectRoot,
                    ignore: this.excludePatterns,
                    absolute: true,
                    nodir: true
                });
                for (const file of files) {
                    allFiles.add(file);
                }
            } catch (error) {
                logger.warn(`Warning: Failed to scan pattern ${pattern}: ${error}`);
            }
        }

        return Array.from(allFiles).sort();
    }

    /**
     * Scans a specific file for TODO comments
     */
    scanFile(filePath: string): ParsedComment[] {
        return this.parser.parseFile(filePath);
    }

    /**
     * Gets the comment parser instance
     */
    getParser(): CommentParser {
        return this.parser;
    }

    /**
     * Gets statistics about the scan patterns
     */
    getPatternStats(): { include: string[]; exclude: string[] } {
        return {
            include: this.includePatterns,
            exclude: this.excludePatterns
        };
    }
}
