import { promptManager } from './prompt-manager.js';
import type { CodeContext, PromptTemplate } from './types.js';

/**
 * @deprecated - Este archivo mantiene compatibilidad con el sistema legacy.
 * El nuevo sistema usa PromptManager con archivos de prompts personalizables.
 */

/**
 * Genera un prompt usando el nuevo sistema de archivos
 */
export async function generatePromptFromFile(
    provider: string,
    context: CodeContext,
    language = 'en'
): Promise<string> {
    return await promptManager.generatePrompt(
        provider,
        context.filePath,
        context.lineNumber,
        context.comment,
        context.beforeLines.join('\n'),
        context.afterLines.join('\n'),
        context.fileType,
        language,
        context.packageName,
        context.imports?.join(', ')
    );
}

/**
 * Genera un prompt batch usando el nuevo sistema
 */
export async function generateBatchPromptFromFile(
    provider: string,
    contexts: CodeContext[],
    language = 'en'
): Promise<string> {
    return await promptManager.generateBatchPrompt(
        provider,
        contexts.map((ctx) => ({
            filePath: ctx.filePath,
            lineNumber: ctx.lineNumber,
            comment: ctx.comment,
            beforeLines: ctx.beforeLines,
            afterLines: ctx.afterLines,
            fileType: ctx.fileType,
            packageName: ctx.packageName,
            imports: ctx.imports
        })),
        language
    );
}

/**
 * @deprecated - Use promptManager.generatePrompt() instead
 * Legacy function maintained for backwards compatibility
 */
export function getPromptTemplate(_provider: string, _language = 'en'): PromptTemplate {
    // Esta función se mantiene para compatibilidad pero ya no se recomienda su uso
    // El nuevo sistema usa archivos de prompts personalizables
    return {
        system: 'Legacy prompt system. Please migrate to file-based prompts.',
        user: (_context: CodeContext) => 'Use promptManager.generatePrompt() instead.'
    };
}
