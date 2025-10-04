import { promptManager } from '../prompt-manager.js';
import type {
    AIAnalysis,
    AIBatchResponse,
    AIConfig,
    AIProviderInterface,
    CodeContext
} from '../types.js';

/**
 * Proveedor de IA para OpenAI API
 */
export class OpenAIProvider implements AIProviderInterface {
    private config: AIConfig;

    constructor(config: AIConfig) {
        this.config = config;
    }

    /**
     * Analiza un comentario TODO usando OpenAI
     */
    async analyze(context: CodeContext): Promise<AIAnalysis> {
        if (!this.isConfigured()) {
            throw new Error('OpenAI provider is not properly configured');
        }

        try {
            const response = await this.makeRequest(context);
            return this.parseResponse(response);
        } catch (error) {
            throw new Error(
                `OpenAI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Verifica si el proveedor está configurado correctamente
     */
    isConfigured(): boolean {
        return !!(this.config.apiKey && this.config.model);
    }

    /**
     * Valida la configuración haciendo una petición de prueba
     */
    async validateConfig(): Promise<boolean> {
        if (!this.isConfigured()) {
            return false;
        }

        try {
            const testContext: CodeContext = {
                filePath: 'test.ts',
                lineNumber: 1,
                comment: 'Test comment',
                beforeLines: [],
                afterLines: [],
                fileType: 'typescript'
            };

            await this.makeRequest(testContext);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Hace la petición a la API de OpenAI
     */
    private async makeRequest(context: CodeContext): Promise<string> {
        // Generar prompt dinámicamente desde archivo
        const prompt = await promptManager.generatePrompt(
            'openai',
            context.filePath,
            context.lineNumber,
            context.comment,
            context.beforeLines.join('\n'),
            context.afterLines.join('\n'),
            context.fileType,
            this.config.language,
            context.packageName,
            context.imports?.join(', ')
        );

        const messages = [
            {
                role: 'user',
                content: prompt
            }
        ];

        const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model: this.config.model,
                messages,
                temperature: 0.1,
                max_tokens: 1000,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(
                `OpenAI API error: ${response.status} ${response.statusText} - ${errorData}`
            );
        }

        const data = await response.json();

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from OpenAI API');
        }

        return data.choices[0].message.content;
    }

    /**
     * Parsea la respuesta JSON de OpenAI
     */
    private parseResponse(response: string): AIAnalysis {
        try {
            const parsed = JSON.parse(response);

            // Validate required fields
            if (!parsed.priority || !parsed.description || !parsed.effort) {
                throw new Error('Missing required fields in AI response');
            }

            // Ensure arrays exist
            parsed.labels = parsed.labels || [];
            parsed.relatedFiles = parsed.relatedFiles || [];
            parsed.suggestions = parsed.suggestions || [];

            // Ensure confidence is set
            parsed.confidence = parsed.confidence || 0.8;

            return parsed as AIAnalysis;
        } catch (error) {
            throw new Error(
                `Failed to parse OpenAI response: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Analiza múltiples comentarios TODO en batch usando OpenAI
     */
    async analyzeBatch(contexts: CodeContext[]): Promise<AIBatchResponse> {
        if (!this.isConfigured()) {
            throw new Error('OpenAI provider is not properly configured');
        }

        try {
            const batchPrompt = await this.createBatchPrompt(contexts);
            const response = await this.makeBatchRequest(batchPrompt);
            return this.parseBatchResponse(response, contexts.length);
        } catch (error) {
            throw new Error(
                `OpenAI batch analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Crea un prompt para análisis batch
     */
    private async createBatchPrompt(contexts: CodeContext[]): Promise<string> {
        return await promptManager.generateBatchPrompt(
            'openai',
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
            this.config.language
        );
    }

    /**
     * Hace una request batch a OpenAI
     */
    private async makeBatchRequest(prompt: string): Promise<unknown> {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.config.model || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Parsea la respuesta batch de OpenAI
     */
    private parseBatchResponse(response: unknown, expectedCount: number): AIBatchResponse {
        try {
            const apiResponse = response as { choices?: Array<{ message?: { content?: string } }> };
            const content = apiResponse.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error('Empty response from OpenAI');
            }

            // Intentar parsear como JSON array
            let parsedAnalyses: AIAnalysis[];
            try {
                parsedAnalyses = JSON.parse(content);
            } catch {
                // Si falla, intentar extraer el JSON del contenido
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (!jsonMatch) {
                    throw new Error('No valid JSON array found in response');
                }
                parsedAnalyses = JSON.parse(jsonMatch[0]);
            }

            if (!Array.isArray(parsedAnalyses)) {
                throw new Error('Response is not an array');
            }

            if (parsedAnalyses.length !== expectedCount) {
                throw new Error(`Expected ${expectedCount} analyses, got ${parsedAnalyses.length}`);
            }

            // Validar y normalizar cada análisis
            const validatedAnalyses = parsedAnalyses.map((analysis, index) => {
                if (!analysis || typeof analysis !== 'object') {
                    throw new Error(`Invalid analysis at index ${index}`);
                }

                // Asegurar que existen las propiedades requeridas
                analysis.labels = analysis.labels || [];
                analysis.relatedFiles = analysis.relatedFiles || [];
                analysis.suggestions = analysis.suggestions || [];
                analysis.confidence = analysis.confidence || 0.8;

                return analysis as AIAnalysis;
            });

            return {
                analyses: validatedAnalyses,
                errors: []
            };
        } catch (error) {
            throw new Error(
                `Failed to parse OpenAI batch response: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}
