import { promptManager } from '../prompt-manager.js';
import type {
    AIAnalysis,
    AIBatchResponse,
    AIConfig,
    AIProviderInterface,
    CodeContext
} from '../types.js';

/**
 * Proveedor de IA para Anthropic Claude API
 */
export class AnthropicProvider implements AIProviderInterface {
    private config: AIConfig;

    constructor(config: AIConfig) {
        this.config = config;
    }

    /**
     * Analiza un comentario TODO usando Anthropic Claude
     */
    async analyze(context: CodeContext): Promise<AIAnalysis> {
        if (!this.isConfigured()) {
            throw new Error('Anthropic provider is not properly configured');
        }

        try {
            const response = await this.makeRequest(context);
            return this.parseResponse(response);
        } catch (error) {
            throw new Error(
                `Anthropic analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
     * Hace la petición a la API de Anthropic
     */
    private async makeRequest(context: CodeContext): Promise<string> {
        // Generar prompt dinámicamente desde archivo
        const prompt = await promptManager.generatePrompt(
            'anthropic',
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

        const baseUrl = this.config.baseUrl || 'https://api.anthropic.com/v1';

        const response = await fetch(`${baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.config.apiKey as string,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.config.model,
                max_tokens: 1000,
                temperature: 0.1,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(
                `Anthropic API error: ${response.status} ${response.statusText} - ${errorData}`
            );
        }

        const data = await response.json();

        if (!data.content || !data.content[0] || !data.content[0].text) {
            throw new Error('Invalid response format from Anthropic API');
        }

        return data.content[0].text;
    }

    /**
     * Parsea la respuesta JSON de Anthropic
     */
    private parseResponse(response: string): AIAnalysis {
        try {
            // Claude sometimes wraps JSON in markdown code blocks
            let jsonText = response.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            const parsed = JSON.parse(jsonText);

            // Validate required fields
            if (!parsed.priority || !parsed.description || !parsed.effort) {
                throw new Error('Missing required fields in AI response');
            }

            // Ensure arrays exist
            parsed.labels = parsed.labels || [];
            parsed.relatedFiles = parsed.relatedFiles || [];
            parsed.suggestions = parsed.suggestions || [];

            // Ensure confidence is set
            parsed.confidence = parsed.confidence || 0.85;

            return parsed as AIAnalysis;
        } catch (error) {
            throw new Error(
                `Failed to parse Anthropic response: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Analiza múltiples comentarios TODO en batch usando Anthropic
     */
    async analyzeBatch(contexts: CodeContext[]): Promise<AIBatchResponse> {
        if (!this.isConfigured()) {
            throw new Error('Anthropic provider is not properly configured');
        }

        try {
            const batchPrompt = this.createBatchPrompt(contexts);
            const response = await this.makeBatchRequest(batchPrompt);
            return this.parseBatchResponse(response, contexts.length);
        } catch (error) {
            throw new Error(
                `Anthropic batch analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Crea un prompt para análisis batch
     */
    private createBatchPrompt(contexts: CodeContext[]): string {
        const systemPrompt = `You are an expert software engineer analyzing TODO comments in codebases. Your job is to provide intelligent analysis of TODO/HACK/DEBUG comments to help developers prioritize and understand their work.

IMPORTANT: Generate the entire response in ${this.config.language?.toUpperCase() || 'ENGLISH'}. All fields "why", "how", "impact", "labels", "relatedFiles" and "suggestions" must be in ${this.config.language || 'English'}.`;

        const batchTemplate = `
${systemPrompt}

Analiza los siguientes ${contexts.length} comentarios TODO y responde con un array JSON que contenga un análisis para cada uno:

${contexts
    .map(
        (ctx, index) => `
--- TODO ${index + 1} ---
Archivo: ${ctx.filePath}
Línea: ${ctx.lineNumber}
Comentario: ${ctx.comment}
Código anterior: ${ctx.beforeLines.join('\n')}
Código posterior: ${ctx.afterLines.join('\n')}
`
    )
    .join('\n')}

Responde ÚNICAMENTE con un array JSON válido con ${contexts.length} objetos de análisis:
[
  { "priority": "...", "description": { "why": "...", "how": "...", "impact": "..." }, "effort": "...", ... },
  { "priority": "...", "description": { "why": "...", "how": "...", "impact": "..." }, "effort": "...", ... },
  ...
]`;

        return batchTemplate;
    }

    /**
     * Hace una request batch a Anthropic
     */
    private async makeBatchRequest(prompt: string): Promise<unknown> {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': this.config.apiKey || '',
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.config.model || 'claude-3-haiku-20240307',
                max_tokens: 4000,
                temperature: 0.3,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Parsea la respuesta batch de Anthropic
     */
    private parseBatchResponse(response: unknown, expectedCount: number): AIBatchResponse {
        try {
            const apiResponse = response as { content?: Array<{ text?: string }> };
            const content = apiResponse.content?.[0]?.text;
            if (!content) {
                throw new Error('Empty response from Anthropic');
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
                analysis.confidence = analysis.confidence || 0.85;

                return analysis as AIAnalysis;
            });

            return {
                analyses: validatedAnalyses,
                errors: []
            };
        } catch (error) {
            throw new Error(
                `Failed to parse Anthropic batch response: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}
