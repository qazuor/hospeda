/**
 * Utilities for handling and formatting AI provider errors
 */

export interface ParsedError {
    provider: string;
    statusCode?: number;
    message: string;
    retryAfter?: string;
    quotaInfo?: string;
    helpUrl?: string;
}

interface GenericErrorData {
    error?: {
        message?: string;
        type?: string;
        code?: string;
        details?: Array<{
            '@type'?: string;
            violations?: Array<{
                quotaMetric?: string;
                quotaValue?: string;
            }>;
            retryDelay?: string;
            links?: Array<{
                url?: string;
            }>;
        }>;
    };
    message?: string;
    code?: number;
    status?: string;
}

/**
 * Parses and formats error messages from AI providers in a user-friendly way
 */
export function parseAIError(error: Error, provider: string): string {
    const originalMessage = error.message;

    // Extract JSON error data if present
    const jsonMatch = originalMessage.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
        return originalMessage;
    }

    try {
        const errorData = JSON.parse(jsonMatch[0]);
        return formatProviderError(errorData, provider);
    } catch {
        return originalMessage;
    }
}

/**
 * Formats specific provider errors
 */
function formatProviderError(errorData: GenericErrorData, provider: string): string {
    switch (provider) {
        case 'openai':
            return formatOpenAIError(errorData);
        case 'anthropic':
            return formatAnthropicError(errorData);
        case 'gemini':
            return formatGeminiError(errorData);
        case 'deepseek':
            return formatDeepSeekError(errorData);
        case 'groq':
            return formatGroqError(errorData);
        default:
            return formatGenericError(errorData);
    }
}

/**
 * Formats OpenAI API errors
 */
function formatOpenAIError(errorData: GenericErrorData): string {
    const error = errorData.error;
    if (!error) return JSON.stringify(errorData);

    let message = error.message || 'Unknown OpenAI error';

    if (error.type === 'insufficient_quota') {
        message += ' Please check your billing details and add credits to your account.';
    }

    return message;
}

/**
 * Formats Anthropic API errors
 */
function formatAnthropicError(errorData: GenericErrorData): string {
    const error = errorData.error;
    if (!error) return JSON.stringify(errorData);

    let message = error.message || 'Unknown Anthropic error';

    if (error.type === 'invalid_request_error' && message.includes('credit balance')) {
        message += ' Please go to Plans & Billing to upgrade or purchase credits.';
    }

    return message;
}

/**
 * Formats Google Gemini API errors
 */
function formatGeminiError(errorData: GenericErrorData): string {
    const error = errorData.error;
    if (!error) return JSON.stringify(errorData);

    let message = error.message || 'Unknown Gemini error';

    // Extract quota information
    if (error.details) {
        const quotaFailure = error.details.find((detail) =>
            detail['@type']?.includes('QuotaFailure')
        );

        if (quotaFailure?.violations?.[0]) {
            const violation = quotaFailure.violations[0];
            message += ` Quota exceeded for metric: ${violation.quotaMetric}, limit: ${violation.quotaValue}.`;
        }

        // Extract retry information
        const retryInfo = error.details.find((detail) => detail['@type']?.includes('RetryInfo'));

        if (retryInfo?.retryDelay) {
            const seconds = retryInfo.retryDelay.replace('s', '');
            message += ` Please retry in ${seconds} seconds.`;
        }

        // Extract help URL
        const helpInfo = error.details.find((detail) => detail['@type']?.includes('Help'));

        if (helpInfo?.links?.[0]?.url) {
            message += ` For more information: ${helpInfo.links[0].url}`;
        }
    }

    return message;
}

/**
 * Formats DeepSeek API errors
 */
function formatDeepSeekError(errorData: GenericErrorData): string {
    const error = errorData.error;
    if (!error) return JSON.stringify(errorData);

    let message = error.message || 'Unknown DeepSeek error';

    // Handle rate limiting
    if (message.includes('rate limit') || message.includes('quota')) {
        message +=
            ' DeepSeek has generous free limits - this should be rare. Please try again in a moment.';
    }

    // Handle authentication
    if (message.includes('authentication') || message.includes('api key')) {
        message += ' Please check your DeepSeek API key at https://platform.deepseek.com/api_keys';
    }

    return message;
}

/**
 * Formats Groq API errors
 */
function formatGroqError(errorData: GenericErrorData): string {
    const error = errorData.error;
    if (!error) return JSON.stringify(errorData);

    let message = error.message || 'Unknown Groq error';

    // Handle rate limiting
    if (message.includes('rate limit') || message.includes('quota')) {
        message += ' Groq free tier: 6,000 tokens/minute. Please wait a moment and try again.';
    }

    // Handle authentication
    if (message.includes('authentication') || message.includes('api key')) {
        message += ' Please check your Groq API key at https://console.groq.com/keys';
    }

    // Handle model availability
    if (message.includes('model') && message.includes('not found')) {
        message += ' Try using llama-3.1-8b-instant or mixtral-8x7b-32768 models.';
    }

    return message;
}

/**
 * Formats generic API errors
 */
function formatGenericError(errorData: GenericErrorData): string {
    if (errorData.message) {
        return errorData.message;
    }

    if (errorData.error?.message) {
        return errorData.error.message;
    }

    return JSON.stringify(errorData);
}
