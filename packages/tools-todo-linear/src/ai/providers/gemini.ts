import { promptManager } from '../prompt-manager.js';
import type {
    AIAnalysis,
    AIBatchResponse,
    AIConfig,
    AIProviderInterface,
    CodeContext
} from '../types.js';

/**
 * Proveedor de IA para Google Gemini API
 */
export class GeminiProvider implements AIProviderInterface {
    private config: AIConfig;

    constructor(config: AIConfig) {
        this.config = config;
    }

    /**
     * Analiza un comentario TODO usando Google Gemini
     */
    async analyze(context: CodeContext): Promise<AIAnalysis> {
        if (!this.isConfigured()) {
            throw new Error('Gemini provider is not properly configured');
        }

        try {
            const response = await this.makeRequest(context);
            return this.parseResponse(response);
        } catch (error) {
            throw new Error(
                `Gemini analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
     * Hace la petición a la API de Gemini
     */
    private async makeRequest(context: CodeContext): Promise<string> {
        // Generar prompt dinámicamente desde archivo
        const prompt = await promptManager.generatePrompt(
            'gemini',
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

        const baseUrl = this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';

        const response = await fetch(
            `${baseUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1000,
                        responseMimeType: 'application/json'
                    }
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(
                `Gemini API error: ${response.status} ${response.statusText} - ${errorData}`
            );
        }

        const data = await response.json();

        if (
            !data.candidates ||
            !data.candidates[0] ||
            !data.candidates[0].content ||
            !data.candidates[0].content.parts ||
            !data.candidates[0].content.parts[0]
        ) {
            throw new Error('Invalid response format from Gemini API');
        }

        return data.candidates[0].content.parts[0].text;
    }

    /**
     * Parsea la respuesta JSON de Gemini
     */
    private parseResponse(response: string): AIAnalysis {
        try {
            // Gemini sometimes includes extra text before/after JSON
            let jsonText = response.trim();

            // Try to extract JSON from the response
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonText = jsonMatch[0];
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
            parsed.confidence = parsed.confidence || 0.82;

            return parsed as AIAnalysis;
        } catch (error) {
            throw new Error(
                `Failed to parse Gemini response: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Analiza múltiples comentarios TODO en batch usando Gemini
     */
    async analyzeBatch(contexts: CodeContext[]): Promise<AIBatchResponse> {
        if (!this.isConfigured()) {
            throw new Error('Gemini provider is not properly configured');
        }

        try {
            const batchPrompt = this.createBatchPrompt(contexts);
            const response = await this.makeBatchRequest(batchPrompt);
            return this.parseBatchResponse(response, contexts.length);
        } catch (error) {
            throw new Error(
                `Gemini batch analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
     * Hace una request batch a Gemini
     */
    private async makeBatchRequest(prompt: string): Promise<unknown> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model || 'gemini-1.5-flash'}:generateContent?key=${this.config.apiKey || ''}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ],
                generationConfig: {
                    temperature: 0.3,
                    candidateCount: 1,
                    maxOutputTokens: 4096
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Parsea la respuesta batch de Gemini
     */
    private parseBatchResponse(response: unknown, expectedCount: number): AIBatchResponse {
        try {
            const apiResponse = response as {
                candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            };
            const content = apiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!content) {
                throw new Error('Empty response from Gemini');
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
                analysis.confidence = analysis.confidence || 0.82;

                return analysis as AIAnalysis;
            });

            return {
                analyses: validatedAnalyses,
                errors: []
            };
        } catch (error) {
            throw new Error(
                `Failed to parse Gemini batch response: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}
