/**
 * File system management for mockup storage
 *
 * @module utils/file-system-manager
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { ErrorCode, MockupError, type SaveMockupOptions } from '../types';

/**
 * Manages file system operations for mockup storage
 */
export class FileSystemManager {
    /**
     * Ensures mockups directory exists in session path
     *
     * @param sessionPath - Path to planning session
     * @returns Path to mockups directory
     *
     * @example
     * ```ts
     * const manager = new FileSystemManager();
     * const mockupsDir = await manager.ensureMockupsDir('.claude/sessions/planning/P-005');
     * // Returns: '.claude/sessions/planning/P-005/mockups'
     * ```
     */
    async ensureMockupsDir(sessionPath: string): Promise<string> {
        const mockupsDir = path.join(sessionPath, 'mockups');

        try {
            await fs.mkdir(mockupsDir, { recursive: true });
            return mockupsDir;
        } catch (error) {
            throw new MockupError(
                `No se pudo crear el directorio de mockups: ${(error as Error).message}`,
                ErrorCode.FILE_SYSTEM_ERROR,
                false,
                error
            );
        }
    }

    /**
     * Saves mockup image to filesystem
     *
     * @param options - Save options including path, description, and image buffer
     * @returns Path to saved file
     *
     * @example
     * ```ts
     * const manager = new FileSystemManager();
     * const filePath = await manager.saveMockup({
     *   sessionPath: '.claude/sessions/planning/P-005',
     *   description: 'Login screen',
     *   imageBuffer: buffer,
     *   format: 'png'
     * });
     * ```
     */
    async saveMockup(options: SaveMockupOptions): Promise<string> {
        const { sessionPath, description, imageBuffer, format = 'png' } = options;

        try {
            // Ensure mockups directory exists
            const mockupsDir = await this.ensureMockupsDir(sessionPath);

            // Generate filename
            let filename = `${this.generateFilename(description)}.${format}`;
            let filePath = path.join(mockupsDir, filename);

            // Avoid name collisions
            let counter = 1;
            while (await this.fileExists(filePath)) {
                filename = `${this.generateFilename(description)}-${counter}.${format}`;
                filePath = path.join(mockupsDir, filename);
                counter++;
            }

            // Save file
            await fs.writeFile(filePath, imageBuffer);

            return filePath;
        } catch (error) {
            if (error instanceof MockupError) {
                throw error;
            }

            throw new MockupError(
                `No se pudo guardar el mockup: ${(error as Error).message}`,
                ErrorCode.FILE_SYSTEM_ERROR,
                false,
                error
            );
        }
    }

    /**
     * Generates unique filename from description
     *
     * @param description - Description of mockup
     * @returns Sanitized filename with timestamp
     *
     * @example
     * ```ts
     * const manager = new FileSystemManager();
     * const filename = manager.generateFilename('Login Screen');
     * // Returns: 'login-screen-2025-11-04T01-15-30-123Z'
     * ```
     */
    generateFilename(description: string): string {
        // Sanitize description
        let sanitized = description
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

        // Truncate to 50 characters
        if (sanitized.length > 50) {
            sanitized = sanitized.substring(0, 50).replace(/-$/, '');
        }

        // Add timestamp for uniqueness
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        return `${sanitized}-${timestamp}`;
    }

    /**
     * Checks if file exists
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}
