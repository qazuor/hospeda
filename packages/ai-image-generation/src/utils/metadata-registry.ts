/**
 * Metadata registry for tracking generated mockups
 *
 * @module utils/metadata-registry
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { ErrorCode, MockupError, type MockupMetadata, type Registry } from '../types';

/**
 * Manages mockup metadata registry
 */
export class MetadataRegistry {
    private readonly registryFilename = '.registry.json';

    /**
     * Loads registry from session path
     *
     * @param sessionPath - Path to planning session
     * @returns Registry data
     *
     * @example
     * ```ts
     * const registry = new MetadataRegistry();
     * const data = await registry.load('.claude/sessions/planning/P-005');
     * ```
     */
    async load(sessionPath: string): Promise<Registry> {
        const registryPath = this.getRegistryPath(sessionPath);

        try {
            // Check if file exists
            const content = await fs.readFile(registryPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            // If file doesn't exist, create default registry
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                const defaultRegistry: Registry = {
                    version: '1.0.0',
                    mockups: [],
                    totalCost: 0,
                    lastUpdated: new Date().toISOString()
                };

                await this.save(defaultRegistry, sessionPath);
                return defaultRegistry;
            }

            throw new MockupError(
                `No se pudo cargar el registro de metadata: ${(error as Error).message}`,
                ErrorCode.FILE_SYSTEM_ERROR,
                false,
                error
            );
        }
    }

    /**
     * Saves registry to session path
     *
     * @param registry - Registry data to save
     * @param sessionPath - Path to planning session
     *
     * @example
     * ```ts
     * const registry = new MetadataRegistry();
     * await registry.save(data, '.claude/sessions/planning/P-005');
     * ```
     */
    async save(registry: Registry, sessionPath: string): Promise<void> {
        const registryPath = this.getRegistryPath(sessionPath);

        try {
            // Ensure mockups directory exists
            await fs.mkdir(path.dirname(registryPath), { recursive: true });

            // Save with 2-space indentation for readability
            await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
        } catch (error) {
            throw new MockupError(
                `No se pudo guardar el registro de metadata: ${(error as Error).message}`,
                ErrorCode.FILE_SYSTEM_ERROR,
                false,
                error
            );
        }
    }

    /**
     * Adds mockup metadata to registry
     *
     * @param mockup - Mockup metadata (without ID)
     * @param sessionPath - Path to planning session
     *
     * @example
     * ```ts
     * const registry = new MetadataRegistry();
     * await registry.addMockup({
     *   filename: 'login-2025-11-04.png',
     *   prompt: 'Login screen',
     *   generatedAt: new Date().toISOString(),
     *   cost: 0.003,
     *   model: 'flux-schnell',
     *   dimensions: { width: 1024, height: 768 },
     *   references: []
     * }, '.claude/sessions/planning/P-005');
     * ```
     */
    async addMockup(mockup: Omit<MockupMetadata, 'id'>, sessionPath: string): Promise<void> {
        try {
            // Load current registry
            const registry = await this.load(sessionPath);

            // Create mockup entry with generated ID
            const mockupWithId: MockupMetadata = {
                ...mockup,
                id: this.generateId()
            };

            // Add to registry
            registry.mockups.push(mockupWithId);

            // Update total cost
            registry.totalCost = registry.mockups.reduce((total, m) => total + m.cost, 0);

            // Update timestamp
            registry.lastUpdated = new Date().toISOString();

            // Save updated registry
            await this.save(registry, sessionPath);
        } catch (error) {
            if (error instanceof MockupError) {
                throw error;
            }

            throw new MockupError(
                `No se pudo agregar mockup al registro: ${(error as Error).message}`,
                ErrorCode.FILE_SYSTEM_ERROR,
                false,
                error
            );
        }
    }

    /**
     * Updates references for a mockup
     *
     * @param mockupId - ID of mockup to update
     * @param reference - Reference to add (e.g., 'PDR.md')
     * @param sessionPath - Path to planning session
     *
     * @example
     * ```ts
     * const registry = new MetadataRegistry();
     * await registry.updateReferences('mockup-123', 'PDR.md', sessionPath);
     * ```
     */
    async updateReferences(
        mockupId: string,
        reference: string,
        sessionPath: string
    ): Promise<void> {
        try {
            // Load current registry
            const registry = await this.load(sessionPath);

            // Find mockup
            const mockup = registry.mockups.find((m) => m.id === mockupId);

            if (!mockup) {
                // Silently return if mockup not found (non-critical)
                return;
            }

            // Add reference if not already present
            if (!mockup.references.includes(reference)) {
                mockup.references.push(reference);
            }

            // Update timestamp
            registry.lastUpdated = new Date().toISOString();

            // Save updated registry
            await this.save(registry, sessionPath);
        } catch (error) {
            if (error instanceof MockupError) {
                throw error;
            }

            throw new MockupError(
                `No se pudo actualizar referencias: ${(error as Error).message}`,
                ErrorCode.FILE_SYSTEM_ERROR,
                false,
                error
            );
        }
    }

    /**
     * Gets registry file path
     */
    private getRegistryPath(sessionPath: string): string {
        return path.join(sessionPath, 'mockups', this.registryFilename);
    }

    /**
     * Generates unique ID for mockup
     */
    private generateId(): string {
        return `mockup_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
}
