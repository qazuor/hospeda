export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'groq' | 'disabled';

export type AILanguage = 'en' | 'es' | 'pt' | 'it' | 'de';

export type Priority = 1 | 2 | 3 | 4; // Urgent | High | Normal | Low

export type EffortEstimate = 'small' | 'medium' | 'large';

export interface AIConfig {
    enabled: boolean;
    provider: AIProvider;
    model: string;
    maxContextLines: number;
    language: AILanguage;
    apiKey?: string;
    baseUrl?: string; // For custom endpoints
    batchSize: number;
    delayMs: number;
    maxRetries: number;
}

export interface CodeContext {
    filePath: string;
    lineNumber: number;
    comment: string;
    beforeLines: string[];
    afterLines: string[];
    fileType: string;
    packageName?: string;
    imports?: string[];
}

export interface AIAnalysis {
    priority: Priority;
    description: {
        why: string; // Por qué es necesario
        how: string; // Cómo implementarlo
        impact: string; // Qué impacto tiene
    };
    labels: string[]; // Labels automáticos
    effort: EffortEstimate;
    relatedFiles: string[];
    suggestions: string[];
    confidence: number; // 0-1 score de confianza del análisis
    // Metadata del análisis
    provider?: string; // Proveedor de IA usado (groq, openai, etc.)
    model?: string; // Modelo específico usado
}

export interface AIEnhancedTodo {
    // Datos existentes del TODO
    id: string;
    comment: string;
    filePath: string;
    lineNumber: number;

    // Análisis de IA
    aiAnalysis?: AIAnalysis;
    aiError?: string;
    aiState?: AIState;
    retryCount?: number;
    lastRetry?: string;
}

export type AIState =
    | 'PENDING' // Esperando análisis AI
    | 'COMPLETED' // AI completado exitosamente
    | 'FAILED' // AI falló, necesita retry
    | 'DISABLED' // AI deshabilitado para este TODO
    | 'SKIPPED'; // AI deshabilitado globalmente

export interface AIBatchRequest {
    todos: CodeContext[];
    language: string;
}

export interface AIBatchResponse {
    analyses: (AIAnalysis | null)[];
    errors: (string | null)[];
}

export interface AIProviderInterface {
    analyze(context: CodeContext): Promise<AIAnalysis>;
    analyzeBatch?(contexts: CodeContext[]): Promise<AIBatchResponse>;
    isConfigured(): boolean;
    validateConfig(): Promise<boolean>;
}

export interface PromptTemplate {
    system: string;
    user: (context: CodeContext) => string;
}
