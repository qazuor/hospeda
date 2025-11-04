/**
 * Main orchestrator for mockup generation
 *
 * @module core/mockup-generator
 */

import Replicate from 'replicate';
import sharp from 'sharp';
import {
    ErrorCode,
    type GenerateParams,
    type GenerateResult,
    MockupError,
    type MockupGeneratorConfig
} from '../types';
import { ErrorHandler, FileSystemManager, MetadataRegistry, sanitizePrompt } from '../utils';

/**
 * Extended generate parameters with session path
 */
interface ExtendedGenerateParams extends GenerateParams {
    sessionPath: string;
}

/**
 * Main mockup generator class that orchestrates all components
 */
export class MockupGenerator {
    private readonly config: MockupGeneratorConfig;
    private readonly replicate: Replicate;
    private readonly fileManager: FileSystemManager;
    private readonly metadataRegistry: MetadataRegistry;

    /**
     * Creates a new MockupGenerator instance
     *
     * @param config - Generator configuration
     *
     * @throws {MockupError} If API token is missing
     *
     * @example
     * ```ts
     * const generator = new MockupGenerator({
     *   replicateApiToken: process.env.REPLICATE_API_TOKEN!,
     *   model: 'black-forest-labs/flux-schnell',
     *   outputPath: '.claude/sessions/planning',
     *   maxRetries: 3
     * });
     * ```
     */
    constructor(config: MockupGeneratorConfig) {
        // Validate required config
        if (!config.replicateApiToken) {
            throw new MockupError(
                'El API token de Replicate es requerido',
                ErrorCode.MISSING_API_KEY,
                false
            );
        }

        this.config = {
            model: 'black-forest-labs/flux-schnell',
            maxRetries: 3,
            ...config
        };

        this.replicate = new Replicate({
            auth: this.config.replicateApiToken
        });

        this.fileManager = new FileSystemManager();
        this.metadataRegistry = new MetadataRegistry();
    }

    /**
     * Generates a mockup image from prompt
     *
     * @param params - Generation parameters
     * @returns Generation result with image path and metadata
     *
     * @example
     * ```ts
     * const result = await generator.generate({
     *   prompt: 'Login screen with email and password',
     *   filename: 'login-screen.png',
     *   sessionPath: '.claude/sessions/planning/P-005'
     * });
     *
     * if (result.success) {
     *   console.log('Generated:', result.imagePath);
     * }
     * ```
     */
    async generate(params: ExtendedGenerateParams): Promise<GenerateResult> {
        const startTime = Date.now();
        let retries = 0;

        try {
            // 1. Sanitize prompt
            const sanitizedPrompt = sanitizePrompt(params.prompt);

            // 2. Generate image with retry logic
            const imageUrl = await ErrorHandler.withRetry(
                async () => this.callReplicateAPI(sanitizedPrompt),
                this.config.maxRetries || 3
            );

            // 3. Download image
            const imageBuffer = await ErrorHandler.withRetry(
                async () => this.downloadImage(imageUrl),
                this.config.maxRetries || 3
            );

            retries = 0; // Reset retries on success

            // 4. Process image (compress)
            const processedBuffer = await this.processImage(imageBuffer);

            // 5. Save to filesystem
            const imagePath = await this.fileManager.saveMockup({
                sessionPath: params.sessionPath,
                description: params.filename.replace(/\.\w+$/, ''), // Remove extension
                imageBuffer: processedBuffer,
                format: 'png'
            });

            // 6. Get image dimensions
            const metadata = await sharp(processedBuffer).metadata();

            // 7. Update metadata registry
            await this.metadataRegistry.addMockup(
                {
                    filename: params.filename,
                    prompt: sanitizedPrompt,
                    generatedAt: new Date().toISOString(),
                    cost: this.calculateCost(this.config.model || 'black-forest-labs/flux-schnell'),
                    model: this.config.model || 'black-forest-labs/flux-schnell',
                    dimensions: {
                        width: metadata.width || 1024,
                        height: metadata.height || 768
                    },
                    references: []
                },
                params.sessionPath
            );

            // 8. Return success result
            const endTime = Date.now();
            return {
                success: true,
                imagePath,
                imageUrl,
                prompt: sanitizedPrompt,
                metadata: {
                    generationTime: endTime - startTime,
                    retries,
                    cost: this.calculateCost(this.config.model || 'black-forest-labs/flux-schnell'),
                    model: this.config.model || 'black-forest-labs/flux-schnell',
                    timestamp: new Date().toISOString(),
                    dimensions: {
                        width: metadata.width || 1024,
                        height: metadata.height || 768
                    }
                }
            };
        } catch (error) {
            // Return error result
            const endTime = Date.now();

            if (error instanceof MockupError) {
                retries = this.config.maxRetries || 3;
            }

            return {
                success: false,
                prompt: params.prompt,
                error: error instanceof Error ? error.message : 'Error desconocido',
                metadata: {
                    generationTime: endTime - startTime,
                    retries,
                    cost: 0,
                    model: this.config.model || 'black-forest-labs/flux-schnell',
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Calls Replicate API to generate image
     */
    private async callReplicateAPI(prompt: string): Promise<string> {
        try {
            const model = this.config.model || 'black-forest-labs/flux-schnell';
            const output = await this.replicate.run(model as `${string}/${string}`, {
                input: {
                    prompt,
                    num_inference_steps: 4, // Optimized for schnell
                    width: 1024,
                    height: 768
                }
            });

            // Extract image URL from output
            const imageUrl = Array.isArray(output) ? output[0] : output;

            if (typeof imageUrl !== 'string') {
                throw new MockupError(
                    'Respuesta inesperada de la API de Replicate',
                    ErrorCode.API_ERROR,
                    true
                );
            }

            return imageUrl;
        } catch (error) {
            throw new MockupError(
                `Error al llamar a la API de Replicate: ${(error as Error).message}`,
                ErrorCode.API_ERROR,
                true,
                error
            );
        }
    }

    /**
     * Downloads image from URL
     */
    private async downloadImage(url: string): Promise<Buffer> {
        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            throw new MockupError(
                `Error al descargar la imagen: ${(error as Error).message}`,
                ErrorCode.DOWNLOAD_FAILED,
                true,
                error
            );
        }
    }

    /**
     * Processes image buffer (compress, resize if needed)
     */
    private async processImage(buffer: Buffer): Promise<Buffer> {
        try {
            return await sharp(buffer).png({ compressionLevel: 9 }).toBuffer();
        } catch (_error) {
            // If processing fails, return original buffer
            return buffer;
        }
    }

    /**
     * Calculates cost per image based on model
     */
    private calculateCost(model: string): number {
        const costs: Record<string, number> = {
            'black-forest-labs/flux-schnell': 0.003,
            'black-forest-labs/flux-dev': 0.055,
            'black-forest-labs/flux-pro': 0.055
        };

        return costs[model] || 0.003;
    }
}
