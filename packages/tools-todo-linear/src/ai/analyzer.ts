import type { ParsedComment } from '../types/index.js';
import logger from '../utils/logger.js';
import { AIBatchProcessor } from './batch-processor.js';
import { ContextExtractor } from './context-extractor.js';
import { parseAIError } from './error-handler.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { DeepSeekProvider } from './providers/deepseek.js';
import { GeminiProvider } from './providers/gemini.js';
import { GroqProvider } from './providers/groq.js';
import { OpenAIProvider } from './providers/openai.js';
import type { AIAnalysis, AIConfig, AIProviderInterface, AIState, CodeContext } from './types.js';

/**
 * Analizador principal de IA para comentarios TODO
 */
export class AIAnalyzer {
    private config: AIConfig;
    private provider: AIProviderInterface | null = null;
    private contextExtractor: ContextExtractor;
    private batchProcessor: AIBatchProcessor | null = null;

    constructor(config: AIConfig) {
        this.config = config;
        this.contextExtractor = new ContextExtractor(config.maxContextLines);
        this.initializeProvider();
        this.initializeBatchProcessor();
    }

    /**
     * Inicializa el proveedor de IA basado en la configuración
     */
    private initializeProvider(): void {
        if (!this.config.enabled || this.config.provider === 'disabled') {
            this.provider = null;
            return;
        }

        switch (this.config.provider) {
            case 'openai':
                this.provider = new OpenAIProvider(this.config);
                break;
            case 'anthropic':
                this.provider = new AnthropicProvider(this.config);
                break;
            case 'gemini':
                this.provider = new GeminiProvider(this.config);
                break;
            case 'deepseek':
                this.provider = new DeepSeekProvider(this.config);
                break;
            case 'groq':
                this.provider = new GroqProvider(this.config);
                break;
            default:
                console.warn(
                    `Unknown AI provider: ${this.config.provider}, falling back to disabled`
                );
                this.provider = null;
        }
    }

    /**
     * Inicializa el procesador de lotes
     */
    private initializeBatchProcessor(): void {
        if (!this.provider || !this.config.enabled) {
            this.batchProcessor = null;
            return;
        }

        this.batchProcessor = new AIBatchProcessor(this.config, this.provider);
    }

    /**
     * Analiza un comentario TODO y retorna el análisis de IA
     */
    async analyzeComment(comment: ParsedComment, projectRoot: string): Promise<AIAnalysis | null> {
        if (!this.provider || !this.isEnabled()) {
            return null;
        }

        try {
            // Extraer contexto del código
            const context = this.contextExtractor.extractContext(comment, projectRoot);

            // Realizar análisis con IA
            const analysis = await this.provider.analyze(context);

            // Aplicar heurísticas adicionales para mejorar el análisis
            return this.enhanceAnalysis(analysis, context);
        } catch (error) {
            const friendlyError = parseAIError(
                error instanceof Error ? error : new Error('Unknown error'),
                this.config.provider
            );
            logger.aiWarn(
                `AI analysis failed for comment at ${comment.filePath}:${comment.line}: ${friendlyError}`
            );
            return null;
        }
    }

    /**
     * Analiza múltiples comentarios usando el batch processor inteligente con tracking
     */
    async analyzeCommentsWithTracking(
        comments: ParsedComment[],
        projectRoot: string,
        tracking: import('../core/tracking.js').TrackingManager
    ): Promise<Map<string, AIAnalysis>> {
        if (!this.batchProcessor || !this.isEnabled()) {
            return new Map();
        }

        try {
            // Obtener comentarios que necesitan análisis AI desde el tracking
            const commentsNeedingAI = tracking.getCommentsForAIProcessing(this.config.maxRetries);

            // Filtrar comentarios que necesitan procesamiento:
            // 1. Comentarios que están en tracking y necesitan AI processing
            // 2. Comentarios nuevos que no están en tracking (para crear issues nuevos)
            const commentsToProcess = comments.filter((comment) => {
                const tracked = tracking.findByLocation(
                    comment.filePath,
                    comment.line,
                    comment.title
                );

                // Si no está en tracking, es un comentario nuevo que necesita análisis
                if (!tracked) {
                    return true;
                }

                // Si está en tracking, verificar si necesita análisis según el estado
                return commentsNeedingAI.some(
                    (needsAI) =>
                        needsAI.filePath === comment.filePath &&
                        needsAI.line === comment.line &&
                        needsAI.title === comment.title
                );
            });

            if (commentsToProcess.length === 0) {
                logger.info('📝 No TODOs require AI processing based on tracking');
                return new Map();
            }

            // Convertir comentarios a TodoBatch format usando información del tracking
            const todos = commentsToProcess.map((comment) => {
                const tracked = tracking.findByLocation(
                    comment.filePath,
                    comment.line,
                    comment.title
                );
                return {
                    id: `${comment.filePath}:${comment.line}`,
                    context: this.contextExtractor.extractContext(comment, projectRoot),
                    currentState: (tracked?.aiState ?? 'PENDING') as AIState,
                    retryCount: tracked?.aiRetryCount ?? 0,
                    lastRetry: tracked?.aiLastRetry
                };
            });

            // Procesar con el batch processor
            const result = await this.batchProcessor.processInBatches(todos);

            // Actualizar tracking con los resultados y convertir a Map
            const analysisMap = new Map<string, AIAnalysis>();

            for (const processed of result.processed) {
                const comment = commentsToProcess.find(
                    (c) => `${c.filePath}:${c.line}` === processed.id
                );
                if (!comment) continue;

                const tracked = tracking.findByLocation(
                    comment.filePath,
                    comment.line,
                    comment.title
                );

                // Para comentarios que están en tracking, actualizar el estado
                if (tracked) {
                    if (processed.analysis && processed.newState === 'COMPLETED') {
                        tracking.updateAIState(tracked.linearId, 'COMPLETED', processed.retryCount);
                        analysisMap.set(processed.id, processed.analysis);
                    } else if (processed.error) {
                        const newState = processed.newState as 'FAILED' | 'DISABLED';
                        tracking.updateAIState(
                            tracked.linearId,
                            newState,
                            processed.retryCount,
                            processed.error
                        );
                    }
                } else {
                    // Para comentarios nuevos (no en tracking), solo devolver el análisis
                    // El tracking se actualizará cuando se cree el issue
                    if (processed.analysis && processed.newState === 'COMPLETED') {
                        analysisMap.set(processed.id, processed.analysis);
                    }
                    // Los errores para comentarios nuevos se loggean pero no se guardan en tracking
                    // porque el issue aún no existe
                    if (processed.error) {
                        // Verificar que tenemos la información del comment
                        if (comment) {
                            logger.warn(
                                `AI analysis failed for new comment ${comment.filePath}:${comment.line}: ${processed.error}`
                            );
                        } else {
                            logger.warn(
                                `AI analysis failed for comment with ID ${processed.id}: ${processed.error}`
                            );
                        }
                    }
                }
            }

            if (result.totalErrors > 0) {
                logger.warn(
                    `AI batch processing completed with ${result.totalErrors} errors out of ${result.totalProcessed} items`
                );
            }

            return analysisMap;
        } catch (error) {
            const friendlyError = parseAIError(
                error instanceof Error ? error : new Error('Unknown error'),
                this.config.provider
            );
            logger.error(`Batch AI analysis failed: ${friendlyError}`);
            return new Map();
        }
    }

    /**
     * Analiza múltiples comentarios usando el batch processor inteligente (método legacy)
     */
    async analyzeComments(
        comments: ParsedComment[],
        projectRoot: string
    ): Promise<Map<string, AIAnalysis>> {
        if (!this.batchProcessor || !this.isEnabled()) {
            return new Map();
        }

        try {
            // Convertir comentarios a TodoBatch format
            const todos = comments.map((comment) => ({
                id: `${comment.filePath}:${comment.line}`,
                context: this.contextExtractor.extractContext(comment, projectRoot),
                currentState: 'PENDING' as const,
                retryCount: 0
            }));

            // Procesar con el batch processor
            const result = await this.batchProcessor.processInBatches(todos);

            // Convertir resultado a Map
            const analysisMap = new Map<string, AIAnalysis>();

            for (const processed of result.processed) {
                if (processed.analysis && processed.newState === 'COMPLETED') {
                    analysisMap.set(processed.id, processed.analysis);
                }
            }

            if (result.totalErrors > 0) {
                logger.warn(
                    `AI batch processing completed with ${result.totalErrors} errors out of ${result.totalProcessed} items`
                );
            }

            return analysisMap;
        } catch (error) {
            const friendlyError = parseAIError(
                error instanceof Error ? error : new Error('Unknown error'),
                this.config.provider
            );
            logger.error(`Batch AI analysis failed: ${friendlyError}`);
            return new Map();
        }
    }

    /**
     * Analiza múltiples comentarios usando el método legacy (para fallback)
     */
    async analyzeCommentsLegacy(
        comments: ParsedComment[],
        projectRoot: string,
        concurrency = 5
    ): Promise<Map<string, AIAnalysis>> {
        if (!this.provider || !this.isEnabled()) {
            return new Map();
        }

        const results = new Map<string, AIAnalysis>();

        // Procesar en lotes para evitar sobrecargar la API
        for (let i = 0; i < comments.length; i += concurrency) {
            const batch = comments.slice(i, i + concurrency);

            const promises = batch.map(async (comment) => {
                const key = `${comment.filePath}:${comment.line}`;
                try {
                    const analysis = await this.analyzeComment(comment, projectRoot);
                    if (analysis) {
                        results.set(key, analysis);
                    }
                } catch (error) {
                    const friendlyError = parseAIError(
                        error instanceof Error ? error : new Error('Unknown error'),
                        this.config.provider
                    );
                    console.warn(`Failed to analyze comment ${key}: ${friendlyError}`);
                }
            });

            await Promise.all(promises);

            // Pequeña pausa entre lotes para ser respetuosos con la API
            if (i + concurrency < comments.length) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }

        return results;
    }

    /**
     * Verifica si el análisis de IA está habilitado y configurado
     */
    isEnabled(): boolean {
        return this.config.enabled && this.provider !== null && this.provider.isConfigured();
    }

    /**
     * Valida la configuración del proveedor de IA
     */
    async validateConfiguration(): Promise<boolean> {
        if (!this.provider) {
            return false;
        }

        return this.provider.validateConfig();
    }

    /**
     * Mejora el análisis de IA con heurísticas adicionales
     */
    private enhanceAnalysis(analysis: AIAnalysis, context: CodeContext): AIAnalysis {
        // Aplicar heurísticas basadas en palabras clave del comentario
        if (this.contextExtractor.isUrgent(context.comment)) {
            // Si detectamos urgencia, asegurar que la prioridad no sea muy baja
            if (analysis.priority > 2) {
                analysis.priority = 2; // High
            }
        }

        if (this.contextExtractor.isRefactoring(context.comment)) {
            // Agregar label de refactoring si no está presente
            if (!analysis.labels.includes('refactoring')) {
                analysis.labels.push('refactoring');
            }
        }

        if (this.contextExtractor.isFeature(context.comment)) {
            // Agregar label de feature si no está presente
            if (!analysis.labels.includes('feature')) {
                analysis.labels.push('feature');
            }
        }

        // Agregar labels basados en el tipo de archivo
        const fileTypeLabels = this.getFileTypeLabels(context.fileType);
        for (const label of fileTypeLabels) {
            if (!analysis.labels.includes(label)) {
                analysis.labels.push(label);
            }
        }

        // Agregar el paquete como contexto adicional si está disponible
        if (
            context.packageName &&
            !analysis.relatedFiles.some((file) => file.includes(context.packageName as string))
        ) {
            // Sugerir archivos relacionados en el mismo paquete
            analysis.relatedFiles.push(`${context.packageName}/**`);
        }

        return analysis;
    }

    /**
     * Obtiene labels relevantes basados en el tipo de archivo
     */
    private getFileTypeLabels(fileType: string): string[] {
        const labelMap: Record<string, string[]> = {
            typescript: ['frontend', 'typescript'],
            javascript: ['frontend', 'javascript'],
            python: ['backend', 'python'],
            java: ['backend', 'java'],
            go: ['backend', 'go'],
            rust: ['backend', 'rust'],
            css: ['frontend', 'styling'],
            scss: ['frontend', 'styling'],
            html: ['frontend', 'markup'],
            sql: ['database', 'sql'],
            json: ['configuration'],
            yaml: ['configuration'],
            markdown: ['documentation']
        };

        return labelMap[fileType] || [];
    }
}
