import logger from '../utils/logger.js';
import { parseAIError } from './error-handler.js';
import type {
    AIAnalysis,
    AIBatchResponse,
    AIConfig,
    AIProviderInterface,
    AIState,
    CodeContext
} from './types.js';

/**
 * Información de un TODO para procesamiento batch
 */
export interface BatchTodoItem {
    id: string;
    context: CodeContext;
    currentState: AIState;
    retryCount: number;
    lastRetry?: string;
}

/**
 * Resultado del procesamiento batch
 */
export interface BatchProcessResult {
    processed: Array<{
        id: string;
        analysis?: AIAnalysis;
        error?: string;
        newState: AIState;
        retryCount: number;
    }>;
    totalProcessed: number;
    totalErrors: number;
    avgProcessingTime: number;
}

/**
 * Manejador de procesamiento batch y retry para análisis AI
 */
export class AIBatchProcessor {
    private config: AIConfig;
    private provider: AIProviderInterface;

    constructor(config: AIConfig, provider: AIProviderInterface) {
        this.config = config;
        this.provider = provider;
    }

    /**
     * Procesa una lista de TODOs en batches con retry
     */
    async processInBatches(todos: BatchTodoItem[]): Promise<BatchProcessResult> {
        const startTime = Date.now();
        const results: BatchProcessResult['processed'] = [];
        let totalErrors = 0;

        // Filtrar TODOs que necesitan procesamiento
        const todosToProcess = todos.filter((todo) => this.shouldProcessTodo(todo));

        if (todosToProcess.length === 0) {
            logger.info('📝 No TODOs require AI processing');
            return {
                processed: [],
                totalProcessed: 0,
                totalErrors: 0,
                avgProcessingTime: 0
            };
        }

        logger.info(
            `🤖 Processing ${todosToProcess.length} TODOs with AI (batch size: ${this.config.batchSize})`
        );

        // Dividir en batches
        const batches = this.createBatches(todosToProcess, this.config.batchSize || 3);

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            if (!batch) continue;

            const batchIndex = i + 1;

            logger.info(
                `📦 Processing batch ${batchIndex}/${batches.length} (${batch.length} items)`
            );

            try {
                const batchResults = await this.processBatch(batch);
                results.push(...batchResults);

                // Contar errores
                totalErrors += batchResults.filter((r) => r.error).length;

                // Delay entre batches (excepto el último)
                if (i < batches.length - 1) {
                    logger.info(`⏳ Waiting ${this.config.delayMs}ms before next batch...`);
                    await this.sleep(this.config.delayMs);
                }
            } catch (error) {
                logger.error(`❌ Batch ${batchIndex} failed completely:`, error);

                // Marcar todos los TODOs del batch como fallidos
                const batchFailures = batch.map((todo) => ({
                    id: todo.id,
                    error: error instanceof Error ? error.message : 'Unknown batch error',
                    newState: 'FAILED' as AIState,
                    retryCount: todo.retryCount + 1
                }));

                results.push(...batchFailures);
                totalErrors += batch.length;
            }
        }

        const totalTime = Date.now() - startTime;
        const avgTime = results.length > 0 ? totalTime / results.length : 0;

        logger.info(
            `✅ AI processing completed: ${results.length} processed, ${totalErrors} errors, ${avgTime.toFixed(0)}ms avg`
        );

        return {
            processed: results,
            totalProcessed: results.length,
            totalErrors,
            avgProcessingTime: avgTime
        };
    }

    /**
     * Determina si un TODO necesita procesamiento AI
     */
    private shouldProcessTodo(todo: BatchTodoItem): boolean {
        // Skip si AI está deshabilitado
        if (!this.config.enabled) {
            return false;
        }

        // Skip si ya está completado
        if (todo.currentState === 'COMPLETED') {
            return false;
        }

        // Skip si está permanentemente deshabilitado
        if (todo.currentState === 'DISABLED') {
            return false;
        }

        // Skip si está explícitamente marcado como skipped
        if (todo.currentState === 'SKIPPED') {
            return false;
        }

        // Procesar si está en PENDING o FAILED (con límite de reintentos)
        if (todo.currentState === 'PENDING' || todo.currentState === 'FAILED') {
            return todo.retryCount < this.config.maxRetries;
        }

        return true;
    }

    /**
     * Procesa un batch de TODOs
     */
    private async processBatch(batch: BatchTodoItem[]): Promise<BatchProcessResult['processed']> {
        const contexts = batch.map((todo) => todo.context);

        try {
            // Intentar procesamiento batch si está disponible
            if (this.provider.analyzeBatch) {
                const batchResponse = await this.provider.analyzeBatch(contexts);
                return this.processBatchResponse(batch, batchResponse);
            }

            // Fallback a procesamiento individual
            return await this.processIndividually(batch);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const friendlyError = parseAIError(error as Error, this.config.provider);

            logger.error(`❌ Batch processing failed: ${friendlyError}`);

            // Retornar errores para todos los items del batch
            return batch.map((todo) => ({
                id: todo.id,
                error: friendlyError,
                newState: this.shouldRetry(errorMessage, todo.retryCount)
                    ? ('FAILED' as AIState)
                    : ('DISABLED' as AIState),
                retryCount: todo.retryCount + 1
            }));
        }
    }

    /**
     * Procesa respuesta de batch
     */
    private processBatchResponse(
        batch: BatchTodoItem[],
        response: AIBatchResponse
    ): BatchProcessResult['processed'] {
        return batch.map((todo, index) => {
            const analysis = response.analyses[index];
            const error = response.errors[index];

            if (analysis && !error) {
                return {
                    id: todo.id,
                    analysis,
                    newState: 'COMPLETED' as AIState,
                    retryCount: todo.retryCount
                };
            }

            const errorMessage = error || 'Unknown analysis error';
            const newRetryCount = todo.retryCount + 1;
            const shouldRetry = this.shouldRetry(errorMessage, todo.retryCount);

            return {
                id: todo.id,
                error: errorMessage,
                newState: shouldRetry ? 'PENDING' : 'FAILED',
                retryCount: newRetryCount
            };
        });
    }

    /**
     * Procesa TODOs individualmente (fallback)
     */
    private async processIndividually(
        batch: BatchTodoItem[]
    ): Promise<BatchProcessResult['processed']> {
        const results: BatchProcessResult['processed'] = [];

        for (let i = 0; i < batch.length; i++) {
            const todo = batch[i];
            if (!todo) continue;

            try {
                const analysis = await this.provider.analyze(todo.context);
                results.push({
                    id: todo.id,
                    analysis,
                    newState: 'COMPLETED',
                    retryCount: todo.retryCount
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const friendlyError = parseAIError(error as Error, this.config.provider);
                const newRetryCount = todo.retryCount + 1;
                const shouldRetry = this.shouldRetry(errorMessage, todo.retryCount);

                results.push({
                    id: todo.id,
                    error: friendlyError,
                    newState: shouldRetry ? 'PENDING' : 'FAILED',
                    retryCount: newRetryCount
                });
            }

            // Delay entre TODOs individuales (excepto el último)
            if (i < batch.length - 1) {
                logger.info(`⏳ Waiting ${this.config.delayMs}ms before next TODO...`);
                await this.sleep(this.config.delayMs);
            }
        }

        return results;
    }

    /**
     * Determina si se debe reintentar basado en el error y número de intentos
     */
    private shouldRetry(error: string, retryCount: number): boolean {
        // No retry si ya se alcanzó el máximo
        if (retryCount >= this.config.maxRetries) {
            return false;
        }

        // Rate limit → retry
        if (error.includes('rate limit') || error.includes('Rate limit')) {
            return retryCount < 3;
        }

        // Quota exceeded → retry
        if (error.includes('quota') || error.includes('Quota')) {
            return retryCount < 2;
        }

        // Invalid API key → no retry
        if (error.includes('api key') || error.includes('authentication')) {
            return false;
        }

        // Modelo no encontrado → no retry
        if (error.includes('model') && error.includes('not found')) {
            return false;
        }

        // Error genérico → retry limitado
        return retryCount < 3;
    }

    /**
     * Crea batches de TODOs
     */
    private createBatches<T>(items: T[], batchSize: number): T[][] {
        const batches: T[][] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Helper para sleep
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Genera descripción de estado para mostrar en Linear
     */
    static generateStateDescription(state: AIState, error?: string, retryCount = 0): string {
        switch (state) {
            case 'PENDING':
                return '🤖 **Estado AI**: Análisis pendiente';
            case 'COMPLETED':
                return '✅ **Estado AI**: Análisis completado';
            case 'FAILED':
                return `⚠️ **Estado AI**: Análisis pendiente (fallo anterior: ${error})\n*Se reintentará en la próxima sincronización (intento ${retryCount}/${3})*`;
            case 'DISABLED':
                return `❌ **Estado AI**: Análisis deshabilitado (fallos repetidos: ${error})`;
            case 'SKIPPED':
                return '⏭️ **Estado AI**: Análisis deshabilitado globalmente';
            default:
                return '';
        }
    }
}
