import { promptManager } from '../prompt-manager.js';
import type {
    AIAnalysis,
    AIBatchResponse,
    AIConfig,
    AIProviderInterface,
    CodeContext,
    EffortEstimate,
    Priority
} from '../types.js';

interface GroqResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

/**
 * Mapea strings de prioridad a números válidos para Linear
 */
function mapPriority(priority: unknown): Priority {
    if (typeof priority === 'number' && priority >= 1 && priority <= 4) {
        return priority as Priority;
    }

    // Validación segura para evitar errores con undefined/null
    const priorityStr = priority ? String(priority).toLowerCase() : '';
    switch (priorityStr) {
        case 'urgent':
        case 'critical':
        case '1':
            return 1;
        case 'high':
        case '2':
            return 2;
        case 'normal':
        case 'medium':
        case '3':
            return 3;
        case 'low':
        case '4':
            return 4;
        default:
            return 3; // Default to normal
    }
}

/**
 * Mapea strings de effort a valores válidos
 */
function mapEffort(effort: unknown): EffortEstimate {
    // Validación segura para evitar errores con undefined/null
    const effortStr = effort ? String(effort).toLowerCase() : '';
    switch (effortStr) {
        case 'small':
        case 'quick':
        case 'easy':
            return 'small';
        case 'large':
        case 'big':
        case 'complex':
            return 'large';
        default:
            return 'medium';
    }
}

/**
 * Proveedor de IA para Groq API (GRATUITO con límites muy generosos)
 *
 * Groq ofrece:
 * - API gratuita con 6,000 tokens/minuto
 * - Modelos de alta velocidad (Llama 3, Mixtral)
 * - Muy rápido en respuestas
 * - Compatible con formato OpenAI
 */
export class GroqProvider implements AIProviderInterface {
    private config: AIConfig;
    private baseURL = 'https://api.groq.com/openai/v1';

    constructor(config: AIConfig) {
        this.config = config;
    }

    /**
     * Analiza un comentario TODO usando Groq
     */
    async analyze(context: CodeContext): Promise<AIAnalysis> {
        if (!this.isConfigured()) {
            throw new Error(
                'Groq provider is not properly configured. Please set TODO_LINEAR_AI_API_KEY.'
            );
        }

        try {
            const response = await this.makeRequest(context);
            return this.parseResponse(response);
        } catch (error) {
            throw new Error(
                `Groq analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Verifica si el proveedor está configurado correctamente
     */
    isConfigured(): boolean {
        return !!(this.config.apiKey && this.config.apiKey.length > 0);
    }

    /**
     * Valida la configuración conectándose a la API
     */
    async validateConfig(): Promise<boolean> {
        if (!this.isConfigured()) {
            return false;
        }

        try {
            // Test simple con un prompt mínimo
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model || 'llama3-8b-8192',
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 5
                })
            });

            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Realiza la petición a la API de Groq
     */
    private async makeRequest(context: CodeContext): Promise<GroqResponse> {
        // Generar prompt dinámicamente desde archivo
        const prompt = await promptManager.generatePrompt(
            'groq',
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

        const payload = {
            model: this.config.model || 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 1000,
            stream: false
        };

        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Groq API error (${response.status}): ${errorData}`);
        }

        return response.json();
    }

    /**
     * Parsea la respuesta de Groq
     */
    private parseResponse(response: GroqResponse): AIAnalysis {
        if (!response.choices || !response.choices[0]?.message?.content) {
            throw new Error('Invalid response format from Groq API');
        }

        try {
            const content = response.choices[0].message.content;

            // Groq a veces devuelve el JSON dentro de un bloque de código
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : content;

            const analysis = JSON.parse(jsonString);

            return {
                priority: mapPriority(analysis.priority),
                description: {
                    why: analysis.description?.why || analysis.why || 'Analysis needed',
                    how:
                        analysis.description?.how ||
                        analysis.how ||
                        'Implementation approach needed',
                    impact:
                        analysis.description?.impact ||
                        analysis.impact ||
                        'Impact assessment needed'
                },
                labels: Array.isArray(analysis.labels) ? analysis.labels : ['todo'],
                effort: mapEffort(analysis.effort),
                relatedFiles: Array.isArray(analysis.relatedFiles) ? analysis.relatedFiles : [],
                suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
                confidence: analysis.confidence || 0.8,
                provider: 'Groq',
                model: this.config.model || 'qwen/qwen3-32b'
            };
        } catch (parseError) {
            throw new Error(
                `Failed to parse Groq response: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`
            );
        }
    }

    /**
     * Analiza múltiples comentarios TODO en batch usando Groq
     */
    async analyzeBatch(contexts: CodeContext[]): Promise<AIBatchResponse> {
        if (!this.isConfigured()) {
            throw new Error(
                'Groq provider is not properly configured. Please set TODO_LINEAR_AI_API_KEY.'
            );
        }

        try {
            const batchPrompt = this.createBatchPrompt(contexts);
            const response = await this.makeBatchRequest(batchPrompt);
            return this.parseBatchResponse(response, contexts.length);
        } catch (error) {
            throw new Error(
                `Groq batch analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
     * Hace una request batch a Groq
     */
    private async makeBatchRequest(prompt: string): Promise<GroqResponse> {
        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.config.apiKey || ''}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.config.model || 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API error (${response.status}): ${errorText}`);
        }

        return (await response.json()) as GroqResponse;
    }

    /**
     * Parsea la respuesta batch de Groq
     */
    private parseBatchResponse(response: GroqResponse, expectedCount: number): AIBatchResponse {
        try {
            const content = response.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error('Empty response from Groq');
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
                return {
                    priority: mapPriority(analysis.priority),
                    description: analysis.description || { why: '', how: '', impact: '' },
                    effort: mapEffort(analysis.effort),
                    labels: Array.isArray(analysis.labels) ? analysis.labels : [],
                    relatedFiles: Array.isArray(analysis.relatedFiles) ? analysis.relatedFiles : [],
                    suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
                    confidence: analysis.confidence || 0.8,
                    provider: 'Groq',
                    model: this.config.model || 'qwen/qwen3-32b'
                } as AIAnalysis;
            });

            return {
                analyses: validatedAnalyses,
                errors: []
            };
        } catch (error) {
            throw new Error(
                `Failed to parse Groq batch response: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Obtiene información del proveedor
     */
    getProviderInfo(): string {
        return 'Groq (Free tier: 6,000 tokens/minute, very fast)';
    }

    /**
     * Obtiene el nombre del proveedor
     */
    getName(): string {
        return 'groq';
    }
}
