import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import type { ParsedComment } from '../types/index.js';
import type { CodeContext } from './types.js';

/**
 * Extrae el contexto del código alrededor de un comentario TODO
 */
export class ContextExtractor {
    private maxContextLines: number;

    constructor(maxContextLines = 50) {
        this.maxContextLines = maxContextLines;
    }

    /**
     * Extrae el contexto completo para un comentario
     */
    extractContext(comment: ParsedComment, projectRoot: string): CodeContext {
        // Validación para evitar paths undefined
        if (!comment.filePath || !projectRoot) {
            return {
                filePath: comment.filePath || '',
                lineNumber: comment.line,
                comment: comment.title || '',
                beforeLines: [],
                afterLines: [],
                fileType: 'unknown',
                packageName: '',
                imports: []
            };
        }

        const fullPath = `${projectRoot}/${comment.filePath}`;

        try {
            const fileContent = readFileSync(fullPath, 'utf-8');
            const lines = fileContent.split('\n');
            const lineIndex = comment.line - 1; // Convert to 0-based index

            // Extract surrounding lines
            const startLine = Math.max(0, lineIndex - this.maxContextLines);
            const endLine = Math.min(lines.length, lineIndex + this.maxContextLines + 1);

            const beforeLines = lines.slice(startLine, lineIndex);
            const afterLines = lines.slice(lineIndex + 1, endLine);

            // Extract imports from the beginning of the file
            const imports = this.extractImports(lines);

            // Determine file type and package
            const fileType = this.getFileType(comment.filePath);
            const packageName = this.extractPackageName(comment.filePath);

            return {
                filePath: comment.filePath,
                lineNumber: comment.line,
                comment: comment.title,
                beforeLines,
                afterLines,
                fileType,
                packageName,
                imports
            };
        } catch {
            // If we can't read the file, return minimal context
            return {
                filePath: comment.filePath,
                lineNumber: comment.line,
                comment: comment.title,
                beforeLines: [],
                afterLines: [],
                fileType: this.getFileType(comment.filePath),
                packageName: this.extractPackageName(comment.filePath),
                imports: []
            };
        }
    }

    /**
     * Determina el tipo de archivo basado en la extensión
     */
    private getFileType(filePath: string): string {
        const ext = extname(filePath).toLowerCase();

        const typeMap: Record<string, string> = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python',
            '.java': 'java',
            '.go': 'go',
            '.rs': 'rust',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'c',
            '.php': 'php',
            '.rb': 'ruby',
            '.vue': 'vue',
            '.svelte': 'svelte',
            '.css': 'css',
            '.scss': 'scss',
            '.less': 'less',
            '.sql': 'sql',
            '.md': 'markdown',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.toml': 'toml',
            '.xml': 'xml',
            '.html': 'html'
        };

        return typeMap[ext] || 'text';
    }

    /**
     * Extrae el nombre del paquete de la ruta del archivo
     */
    private extractPackageName(filePath: string): string | undefined {
        // Para monorepos con estructura packages/ o apps/
        const parts = filePath.split('/');

        // Buscar patterns comunes de monorepo
        for (let i = 0; i < parts.length - 1; i++) {
            if (parts[i] === 'packages' || parts[i] === 'apps') {
                return parts[i + 1];
            }
        }

        // Si no encontramos un patrón de monorepo, intentar extraer del package.json más cercano
        // Por ahora, retornar undefined
        return undefined;
    }

    /**
     * Extrae las declaraciones de import del archivo
     */
    private extractImports(lines: string[]): string[] {
        const imports: string[] = [];
        const importPatterns = [
            /^import\s+.*from\s+['"][^'"]+['"];?\s*$/, // ES6 imports
            /^import\s+['"][^'"]+['"];?\s*$/, // Side-effect imports
            /^const\s+.*=\s+require\(['"][^'"]+['"]\);?\s*$/, // CommonJS require
            /^from\s+\w+\s+import\s+.*$/, // Python imports
            /^import\s+\w+.*$/, // Python imports
            /^#include\s+<.*>$/, // C/C++ includes
            /^#include\s+".*"$/, // C/C++ includes
            /^use\s+.*$/, // Rust/PHP use
            /^using\s+.*$/ // C# using
        ];

        for (const line of lines) {
            const trimmed = line.trim();

            // Stop at first non-import/non-comment line (simple heuristic)
            if (
                trimmed &&
                !trimmed.startsWith('//') &&
                !trimmed.startsWith('/*') &&
                !trimmed.startsWith('*') &&
                !trimmed.startsWith('#')
            ) {
                const isImport = importPatterns.some((pattern) => pattern.test(trimmed));
                if (isImport) {
                    imports.push(trimmed);
                } else if (imports.length > 0) {
                    // We've started seeing non-import lines, stop
                    break;
                }
            }

            // Limit the number of imports we collect
            if (imports.length >= 20) {
                break;
            }
        }

        return imports;
    }

    /**
     * Determina si un TODO parece urgente basado en palabras clave
     */
    isUrgent(comment: string): boolean {
        const urgentKeywords = [
            'urgent',
            'critical',
            'security',
            'bug',
            'fix',
            'broken',
            'error',
            'crash',
            'performance',
            'memory leak',
            'deadlock',
            'race condition',
            'vulnerability',
            'exploit',
            'urgent',
            'asap',
            'immediately'
        ];

        const lowerComment = comment.toLowerCase();
        return urgentKeywords.some((keyword) => lowerComment.includes(keyword));
    }

    /**
     * Determina si un TODO parece ser de tipo refactoring
     */
    isRefactoring(comment: string): boolean {
        const refactoringKeywords = [
            'refactor',
            'cleanup',
            'simplify',
            'improve',
            'optimize',
            'consolidate',
            'extract',
            'rename',
            'move',
            'reorganize'
        ];

        const lowerComment = comment.toLowerCase();
        return refactoringKeywords.some((keyword) => lowerComment.includes(keyword));
    }

    /**
     * Determina si un TODO parece ser una nueva feature
     */
    isFeature(comment: string): boolean {
        const featureKeywords = [
            'implement',
            'add',
            'create',
            'build',
            'develop',
            'feature',
            'functionality',
            'enhancement',
            'extend',
            'support'
        ];

        const lowerComment = comment.toLowerCase();
        return featureKeywords.some((keyword) => lowerComment.includes(keyword));
    }
}
