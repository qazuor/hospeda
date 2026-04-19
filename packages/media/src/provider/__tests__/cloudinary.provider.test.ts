import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CloudinaryProvider,
    ConfigurationError,
    InvalidFolderError
} from '../cloudinary.provider.js';

// ---------------------------------------------------------------------------
// Mock cloudinary SDK
// vi.hoisted() is required because vi.mock() factory is hoisted to the top of
// the file by Vitest, before any variable declarations run.
// ---------------------------------------------------------------------------

const { mockConfig, mockUploadStream, mockDestroy, mockDeleteByPrefix } = vi.hoisted(() => ({
    mockConfig: vi.fn(),
    mockUploadStream: vi.fn(),
    mockDestroy: vi.fn(),
    mockDeleteByPrefix: vi.fn()
}));

vi.mock('cloudinary', () => ({
    v2: {
        config: mockConfig,
        uploader: {
            upload_stream: mockUploadStream,
            destroy: mockDestroy
        },
        api: {
            delete_resources_by_prefix: mockDeleteByPrefix
        }
    }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_CONFIG = {
    cloudName: 'test-cloud',
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret'
};

const MOCK_UPLOAD_RESPONSE = {
    secure_url: 'https://res.cloudinary.com/hospeda/image/upload/v123/test.jpg',
    public_id: 'hospeda/prod/accommodations/abc-123/gallery/test',
    width: 1920,
    height: 1080,
    format: 'jpg',
    bytes: 123456
};

/**
 * Sets up mockUploadStream to immediately invoke the callback with the given
 * error or result, and returns a fake writable stream.
 */
function setupUploadStream(error: Error | null, result: typeof MOCK_UPLOAD_RESPONSE | null) {
    mockUploadStream.mockImplementation(
        (
            _options: Record<string, unknown>,
            callback: (err: Error | null, result: unknown) => void
        ) => ({
            on: vi.fn(),
            end: vi.fn(() => {
                callback(error, result);
            })
        })
    );
}

/**
 * Sets up mockUploadStream so it never invokes the result callback, but instead
 * emits a transport-level 'error' event via the registered `on('error', ...)`
 * handler. Mirrors the silent-hang scenario GAP-078-027 protects against.
 */
function setupUploadStreamWithTransportError(error: Error) {
    mockUploadStream.mockImplementation(() => {
        const listeners = new Map<string, (err: Error) => void>();
        return {
            on: vi.fn((event: string, handler: (err: Error) => void) => {
                listeners.set(event, handler);
            }),
            end: vi.fn(() => {
                const handler = listeners.get('error');
                if (handler) {
                    handler(error);
                }
            })
        };
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CloudinaryProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // Constructor validation
    // -------------------------------------------------------------------------

    describe('constructor', () => {
        it('should throw ConfigurationError when cloudName is missing', () => {
            expect(() => new CloudinaryProvider({ ...VALID_CONFIG, cloudName: '' })).toThrow(
                ConfigurationError
            );
        });

        it('should throw ConfigurationError with descriptive message when cloudName is missing', () => {
            expect(() => new CloudinaryProvider({ ...VALID_CONFIG, cloudName: '' })).toThrow(
                'Missing HOSPEDA_CLOUDINARY_CLOUD_NAME'
            );
        });

        it('should throw ConfigurationError when apiKey is missing', () => {
            expect(() => new CloudinaryProvider({ ...VALID_CONFIG, apiKey: '' })).toThrow(
                ConfigurationError
            );
        });

        it('should throw ConfigurationError with descriptive message when apiKey is missing', () => {
            expect(() => new CloudinaryProvider({ ...VALID_CONFIG, apiKey: '' })).toThrow(
                'Missing HOSPEDA_CLOUDINARY_API_KEY'
            );
        });

        it('should throw ConfigurationError when apiSecret is missing', () => {
            expect(() => new CloudinaryProvider({ ...VALID_CONFIG, apiSecret: '' })).toThrow(
                ConfigurationError
            );
        });

        it('should throw ConfigurationError with descriptive message when apiSecret is missing', () => {
            expect(() => new CloudinaryProvider({ ...VALID_CONFIG, apiSecret: '' })).toThrow(
                'Missing HOSPEDA_CLOUDINARY_API_SECRET'
            );
        });

        it('should not throw when all config values are present', () => {
            expect(() => new CloudinaryProvider(VALID_CONFIG)).not.toThrow();
        });

        // GAP-078-057: cloudName must match /^[a-z0-9_-]+$/
        it('should throw ConfigurationError when cloudName contains a space', () => {
            // Arrange
            const invalidConfig = { ...VALID_CONFIG, cloudName: 'my cloud!' };

            // Act + Assert
            expect(() => new CloudinaryProvider(invalidConfig)).toThrow(ConfigurationError);
            expect(() => new CloudinaryProvider(invalidConfig)).toThrow(
                /must match \/\^\[a-z0-9_-\]\+\$\//
            );
        });

        it('should throw ConfigurationError when cloudName contains uppercase letters', () => {
            // Arrange
            const invalidConfig = { ...VALID_CONFIG, cloudName: 'MyCloud' };

            // Act + Assert
            expect(() => new CloudinaryProvider(invalidConfig)).toThrow(ConfigurationError);
        });

        it('should throw ConfigurationError when cloudName contains forbidden punctuation', () => {
            // Arrange
            const invalidConfig = { ...VALID_CONFIG, cloudName: 'cloud.name' };

            // Act + Assert
            expect(() => new CloudinaryProvider(invalidConfig)).toThrow(ConfigurationError);
        });

        it('should accept cloudName composed of allowed characters', () => {
            // Arrange
            const validConfig = { ...VALID_CONFIG, cloudName: 'hospeda_dev-01' };

            // Act + Assert
            expect(() => new CloudinaryProvider(validConfig)).not.toThrow();
        });

        it('should call cloudinary.config with snake_case param names', () => {
            new CloudinaryProvider(VALID_CONFIG);

            expect(mockConfig).toHaveBeenCalledOnce();
            expect(mockConfig).toHaveBeenCalledWith({
                cloud_name: VALID_CONFIG.cloudName,
                api_key: VALID_CONFIG.apiKey,
                api_secret: VALID_CONFIG.apiSecret
            });
        });
    });

    // -------------------------------------------------------------------------
    // upload()
    // -------------------------------------------------------------------------

    describe('upload()', () => {
        it('should return the correct shape from a successful upload', async () => {
            setupUploadStream(null, MOCK_UPLOAD_RESPONSE);
            const provider = new CloudinaryProvider(VALID_CONFIG);

            const result = await provider.upload({
                file: Buffer.from('fake-image'),
                folder: 'hospeda/prod/accommodations/abc-123'
            });

            expect(result).toEqual({
                url: MOCK_UPLOAD_RESPONSE.secure_url,
                publicId: MOCK_UPLOAD_RESPONSE.public_id,
                width: MOCK_UPLOAD_RESPONSE.width,
                height: MOCK_UPLOAD_RESPONSE.height
            });
        });

        it('should map secure_url to result.url (not url)', async () => {
            setupUploadStream(null, MOCK_UPLOAD_RESPONSE);
            const provider = new CloudinaryProvider(VALID_CONFIG);

            const result = await provider.upload({
                file: Buffer.from('fake-image'),
                folder: 'hospeda/prod/test'
            });

            expect(result.url).toBe(MOCK_UPLOAD_RESPONSE.secure_url);
        });

        it('should pass publicId in upload options when provided', async () => {
            setupUploadStream(null, MOCK_UPLOAD_RESPONSE);
            const provider = new CloudinaryProvider(VALID_CONFIG);

            await provider.upload({
                file: Buffer.from('fake-image'),
                folder: 'hospeda/prod/accommodations/abc-123',
                publicId: 'my-custom-id'
            });

            const callOptions = mockUploadStream.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(callOptions).toBeDefined();
            expect(callOptions.public_id).toBe('my-custom-id');
        });

        it('should default overwrite to true when not provided', async () => {
            setupUploadStream(null, MOCK_UPLOAD_RESPONSE);
            const provider = new CloudinaryProvider(VALID_CONFIG);

            await provider.upload({
                file: Buffer.from('fake-image'),
                folder: 'hospeda/prod/accommodations/abc-123'
            });

            const callOptions = mockUploadStream.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(callOptions).toBeDefined();
            expect(callOptions.overwrite).toBe(true);
        });

        it('should pass overwrite: false when explicitly set', async () => {
            setupUploadStream(null, MOCK_UPLOAD_RESPONSE);
            const provider = new CloudinaryProvider(VALID_CONFIG);

            await provider.upload({
                file: Buffer.from('fake-image'),
                folder: 'hospeda/prod/accommodations/abc-123',
                overwrite: false
            });

            const callOptions = mockUploadStream.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(callOptions).toBeDefined();
            expect(callOptions.overwrite).toBe(false);
        });

        it('should pass tags in upload options when provided', async () => {
            setupUploadStream(null, MOCK_UPLOAD_RESPONSE);
            const provider = new CloudinaryProvider(VALID_CONFIG);

            await provider.upload({
                file: Buffer.from('fake-image'),
                folder: 'hospeda/prod/accommodations/abc-123',
                tags: ['accommodation', 'gallery']
            });

            const callOptions = mockUploadStream.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(callOptions).toBeDefined();
            expect(callOptions.tags).toEqual(['accommodation', 'gallery']);
        });

        it('should reject with the error when upload_stream callback fires with an error', async () => {
            const uploadError = new Error('Network timeout');
            setupUploadStream(uploadError, null);
            const provider = new CloudinaryProvider(VALID_CONFIG);

            await expect(
                provider.upload({
                    file: Buffer.from('fake-image'),
                    folder: 'hospeda/prod/accommodations/abc-123'
                })
            ).rejects.toThrow('Network timeout');
        });

        it('should reject with error when Cloudinary returns no result', async () => {
            mockUploadStream.mockImplementation(
                (
                    _options: Record<string, unknown>,
                    callback: (err: null, result: undefined) => void
                ) => ({
                    on: vi.fn(),
                    end: vi.fn(() => callback(null, undefined))
                })
            );
            const provider = new CloudinaryProvider(VALID_CONFIG);

            await expect(
                provider.upload({
                    file: Buffer.from('fake-image'),
                    folder: 'hospeda/prod/accommodations/abc-123'
                })
            ).rejects.toThrow('Cloudinary returned no result');
        });

        // GAP-078-027: stream error event must reject the upload promise
        it('should reject when the underlying upload stream emits a transport error event', async () => {
            // Arrange
            const transportError = new Error('socket hang up');
            setupUploadStreamWithTransportError(transportError);
            const provider = new CloudinaryProvider(VALID_CONFIG);

            // Act + Assert
            await expect(
                provider.upload({
                    file: Buffer.from('fake-image'),
                    folder: 'hospeda/prod/accommodations/abc-123'
                })
            ).rejects.toThrow('socket hang up');
        });

        // GAP-078-112: folder must start with 'hospeda/'
        it('should throw InvalidFolderError when folder does not start with hospeda/', async () => {
            // Arrange
            const provider = new CloudinaryProvider(VALID_CONFIG);

            // Act + Assert
            await expect(
                provider.upload({
                    file: Buffer.from('fake-image'),
                    folder: 'other/x'
                })
            ).rejects.toBeInstanceOf(InvalidFolderError);
            // SDK must NOT have been invoked when the guard rejects
            expect(mockUploadStream).not.toHaveBeenCalled();
        });

        it('should throw InvalidFolderError when folder is an empty string', async () => {
            // Arrange
            const provider = new CloudinaryProvider(VALID_CONFIG);

            // Act + Assert
            await expect(
                provider.upload({
                    file: Buffer.from('fake-image'),
                    folder: ''
                })
            ).rejects.toBeInstanceOf(InvalidFolderError);
            expect(mockUploadStream).not.toHaveBeenCalled();
        });

        it('should not be fooled by a folder that merely contains hospeda/ later in the path', async () => {
            // Arrange
            const provider = new CloudinaryProvider(VALID_CONFIG);

            // Act + Assert
            await expect(
                provider.upload({
                    file: Buffer.from('fake-image'),
                    folder: 'evil/hospeda/prod'
                })
            ).rejects.toBeInstanceOf(InvalidFolderError);
            expect(mockUploadStream).not.toHaveBeenCalled();
        });

        it('should throw when Cloudinary returns incomplete response missing secure_url', async () => {
            const incompleteResult = { ...MOCK_UPLOAD_RESPONSE, secure_url: '' };
            setupUploadStream(null, incompleteResult);
            const provider = new CloudinaryProvider(VALID_CONFIG);

            await expect(
                provider.upload({
                    file: Buffer.from('fake-image'),
                    folder: 'hospeda/prod/accommodations/abc-123'
                })
            ).rejects.toThrow('Cloudinary returned an incomplete response');
        });
    });

    // -------------------------------------------------------------------------
    // delete()
    // -------------------------------------------------------------------------

    describe('delete()', () => {
        it('should call cloudinary.uploader.destroy with the given publicId', async () => {
            mockDestroy.mockResolvedValue({ result: 'ok' });
            const provider = new CloudinaryProvider(VALID_CONFIG);

            await provider.delete({ publicId: 'hospeda/prod/accommodations/abc-123/featured' });

            expect(mockDestroy).toHaveBeenCalledOnce();
            expect(mockDestroy).toHaveBeenCalledWith(
                'hospeda/prod/accommodations/abc-123/featured',
                { invalidate: true }
            );
        });

        it('should not throw when Cloudinary returns not found (idempotent delete)', async () => {
            mockDestroy.mockResolvedValue({ result: 'not found' });
            const provider = new CloudinaryProvider(VALID_CONFIG);

            await expect(
                provider.delete({ publicId: 'hospeda/prod/does-not-exist' })
            ).resolves.toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // deleteByPrefix()
    // -------------------------------------------------------------------------

    describe('deleteByPrefix()', () => {
        it('should call cloudinary.api.delete_resources_by_prefix with the given prefix', async () => {
            mockDeleteByPrefix.mockResolvedValue({ deleted: {} });
            const provider = new CloudinaryProvider(VALID_CONFIG);

            await provider.deleteByPrefix({
                prefix: 'hospeda/prod/accommodations/abc-123/'
            });

            expect(mockDeleteByPrefix).toHaveBeenCalledOnce();
            expect(mockDeleteByPrefix).toHaveBeenCalledWith('hospeda/prod/accommodations/abc-123/');
        });
    });
});
