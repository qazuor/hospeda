import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findProjectRoot } from '../config/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Variables que pueden ser reemplazadas en los prompts
 */
export interface PromptVariables {
    languageInstructions: string;
    filePath: string;
    lineNumber: number;
    comment: string;
    beforeContext: string;
    afterContext: string;
    fileType: string;
    packageName?: string;
    imports?: string;
}

/**
 * Información de idioma para diferentes locales
 */
function getLanguageInstructions(language: string): string {
    switch (language) {
        case 'es':
            return 'IMPORTANTE: Genera toda la respuesta en ESPAÑOL. Los campos "why", "how", "impact", "labels", "relatedFiles" y "suggestions" deben estar en español.';
        case 'pt':
            return 'IMPORTANTE: Gere toda a resposta em PORTUGUÊS. Os campos "why", "how", "impact", "labels", "relatedFiles" e "suggestions" devem estar em português.';
        case 'it':
            return 'IMPORTANTE: Genera tutta la risposta in ITALIANO. I campi "why", "how", "impact", "labels", "relatedFiles" e "suggestions" devono essere in italiano.';
        case 'de':
            return 'WICHTIG: Generiere die gesamte Antwort auf DEUTSCH. Die Felder "why", "how", "impact", "labels", "relatedFiles" und "suggestions" müssen auf Deutsch sein.';
        default:
            return 'IMPORTANT: Generate the entire response in ENGLISH. All fields "why", "how", "impact", "labels", "relatedFiles" and "suggestions" must be in English.';
    }
}

/**
 * Gestor de prompts desde archivos
 */
export class PromptManager {
    private readonly promptsDir: string;
    private readonly cache = new Map<string, string>();

    constructor() {
        // Ubicación del directorio de prompts en la raíz del proyecto
        const projectRoot = findProjectRoot();
        this.promptsDir = resolve(projectRoot, '.todoLinear', 'prompts');
    }

    /**
     * Carga un prompt para un proveedor específico
     * Primero busca archivo personalizado, luego el default
     */
    async getPromptTemplate(provider: string): Promise<string> {
        const cacheKey = provider;

        // Verificar cache
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            let promptContent: string;

            // 1. Intentar cargar prompt personalizado (sin .default)
            const customPath = join(this.promptsDir, `${provider}.prompt.md`);

            if (existsSync(customPath)) {
                promptContent = await readFile(customPath, 'utf-8');
            } else {
                // 2. Fallback al prompt default
                const defaultPath = join(this.promptsDir, `${provider}.default.md`);

                if (!existsSync(defaultPath)) {
                    throw new Error(
                        `No prompt template found for provider '${provider}'. Expected: ${defaultPath}`
                    );
                }

                promptContent = await readFile(defaultPath, 'utf-8');
            }

            // Cachear el contenido
            this.cache.set(cacheKey, promptContent);

            return promptContent;
        } catch (error) {
            throw new Error(
                `Failed to load prompt template for ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Reemplaza variables en el template del prompt
     */
    replaceVariables(template: string, variables: PromptVariables): string {
        let result = template;

        // Reemplazar todas las variables usando el formato {{$varName}}
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{$${key}}}`;
            const replacement = value?.toString() || '';
            result = result.replaceAll(placeholder, replacement);
        }

        return result;
    }

    /**
     * Genera un prompt completo para análisis individual
     */
    async generatePrompt(
        provider: string,
        filePath: string,
        lineNumber: number,
        comment: string,
        beforeContext: string,
        afterContext: string,
        fileType: string,
        language = 'en',
        packageName?: string,
        imports?: string
    ): Promise<string> {
        const template = await this.getPromptTemplate(provider);

        const variables: PromptVariables = {
            languageInstructions: getLanguageInstructions(language),
            filePath,
            lineNumber,
            comment,
            beforeContext,
            afterContext,
            fileType,
            packageName: packageName || 'unknown',
            imports: imports || 'none'
        };

        return this.replaceVariables(template, variables);
    }

    /**
     * Genera un prompt para análisis batch
     */
    async generateBatchPrompt(
        _provider: string,
        contexts: Array<{
            filePath: string;
            lineNumber: number;
            comment: string;
            beforeLines: string[];
            afterLines: string[];
            fileType: string;
            packageName?: string;
            imports?: string[];
        }>,
        language = 'en'
    ): Promise<string> {
        const languageInstructions = getLanguageInstructions(language);

        const batchHeader = `You are an expert software engineer analyzing TODO comments in codebases. Your job is to provide intelligent analysis of TODO/HACK/DEBUG comments to help developers prioritize and understand their work.

${languageInstructions}

Analyze the following ${contexts.length} TODO comments and respond with a JSON array containing one analysis object for each comment in the same order:`;

        const contextSections = contexts
            .map(
                (ctx, index) => `
--- TODO ${index + 1} ---
File: ${ctx.filePath}
Line: ${ctx.lineNumber}
Comment: ${ctx.comment}
Code Context:
\`\`\`
${ctx.beforeLines.join('\n')}
${ctx.afterLines.join('\n')}
\`\`\`
File Type: ${ctx.fileType}
Package: ${ctx.packageName || 'unknown'}
Imports: ${ctx.imports?.join(', ') || 'none'}
`
            )
            .join('\n');

        const batchFooter = `
Respond ONLY with a valid JSON array containing ${contexts.length} analysis objects:
[
  {
    "priority": "low|medium|high|critical",
    "description": {
      "why": "...",
      "how": "...",
      "impact": "..."
    },
    "effort": "small|medium|large|epic",
    "labels": ["..."],
    "relatedFiles": ["..."],
    "suggestions": ["..."],
    "confidence": 0.85
  },
  ...
]`;

        return `${batchHeader}\n${contextSections}\n${batchFooter}`;
    }

    /**
     * Lista los prompts disponibles
     */
    async listAvailablePrompts(): Promise<
        { provider: string; custom: boolean; example: boolean }[]
    > {
        const { readdir } = await import('node:fs/promises');

        try {
            const files = await readdir(this.promptsDir);
            const promptMap = new Map<string, { custom: boolean; example: boolean }>();

            for (const file of files) {
                if (!file.endsWith('.md')) continue;

                const isExample = file.includes('.example.');
                const provider = file.replace('.example.md', '').replace('.md', '');

                if (!promptMap.has(provider)) {
                    promptMap.set(provider, { custom: false, example: false });
                }

                const entry = promptMap.get(provider);
                if (!entry) continue;

                if (isExample) {
                    entry.example = true;
                } else {
                    entry.custom = true;
                }
            }

            return Array.from(promptMap.entries()).map(([provider, flags]) => ({
                provider,
                ...flags
            }));
        } catch (error) {
            throw new Error(
                `Failed to list prompts: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Limpia el cache de prompts
     */
    clearCache(): void {
        this.cache.clear();
    }
}

// Instancia singleton del gestor de prompts
export const promptManager = new PromptManager();
