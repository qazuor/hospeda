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

const { mockConfig, mockUploadStream, mockDestroy, mockDeleteByPrefix, mockPing } = vi.hoisted(
    () => ({
        mockConfig: vi.fn(),
        mockUploadStream: vi.fn(),
        mockDestroy: vi.fn(),
        mockDeleteByPrefix: vi.fn(),
        mockPing: vi.fn()
    })
);

vi.mock('cloudinary', () => ({
    v2: {
        config: mockConfig,
        uploader: {
            upload_stream: mockUploadStream,
            destroy: mockDestroy
        },
        api: {
            delete_resources_by_prefix: mockDeleteByPrefix,
            ping: mockPing
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
 * Sets up mockUploadStream to invoke the callback asynchronously with the given
 * error or result, and returns a fake writable stream.
 *
 * SPEC-078-GAPS GAP-078-210: callbacks fire via `setImmediate` (NOT
 * synchronously inside `end()`) so the mock mirrors the real Cloudinary SDK,
 * which always defers `upload_stream` callbacks to a later microtask. A
 * synchronous mock would mask race conditions where the production code
 * accidentally relies on the callback firing before `end()` returns.
 */
function setupUploadStream(error: Error | null, result: typeof MOCK_UPLOAD_RESPONSE | null) {
    mockUploadStream.mockImplementation(
        (
            _options: Record<string, unknown>,
            callback: (err: Error | null, result: unknown) => void
        ) => ({
            on: vi.fn(),
            end: vi.fn(() => {
                setImmediate(callback, error, result);
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
            // GAP-078-210: setImmediate to mirror real SDK async callback timing.
            mockUploadStream.mockImplementation(
                (
                    _options: Record<string, unknown>,
                    callback: (err: null, result: undefined) => void
                ) => ({
                    on: vi.fn(),
                    end: vi.fn(() => {
                        setImmediate(callback, null, undefined);
                    })
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

        // SPEC-078-GAPS GAP-078-087: upload() has NO retry by design
        it('should NOT retry on upload failure even if the error looks transient (5xx)', async () => {
            // Arrange: simulate a 500-like upstream error from upload_stream
            const uploadError = Object.assign(new Error('Upstream failure'), { http_code: 500 });
            setupUploadStream(uploadError, null);
            const provider = new CloudinaryProvider(VALID_CONFIG);

            // Act + Assert
            await expect(
                provider.upload({
                    file: Buffer.from('fake-image'),
                    folder: 'hospeda/prod/accommodations/abc-123'
                })
            ).rejects.toThrow('Upstream failure');
            expect(mockUploadStream).toHaveBeenCalledTimes(1);
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

        // GAP-078-085: data-URI input shape.
        // The provider's `UploadOptions.file` is typed as Buffer, so callers
        // converting a `data:image/png;base64,...` URI into a Buffer must work
        // end-to-end. We assert the decoded buffer reaches the SDK unchanged.
        it('should upload a Buffer derived from a base64 data-URI', async () => {
            // Arrange — minimal 1x1 transparent PNG encoded as a data-URI.
            const base64Payload =
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
            const dataUri = `data:image/png;base64,${base64Payload}`;
            const commaIndex = dataUri.indexOf(',');
            const buffer = Buffer.from(dataUri.slice(commaIndex + 1), 'base64');

            let endedWith: Buffer | undefined;
            mockUploadStream.mockImplementation(
                (
                    _options: Record<string, unknown>,
                    callback: (err: Error | null, result: unknown) => void
                ) => ({
                    on: vi.fn(),
                    end: vi.fn((chunk: Buffer) => {
                        endedWith = chunk;
                        setImmediate(callback, null, MOCK_UPLOAD_RESPONSE);
                    })
                })
            );
            const provider = new CloudinaryProvider(VALID_CONFIG);

            // Act
            const result = await provider.upload({
                file: buffer,
                folder: 'hospeda/prod/users/avatar-from-data-uri'
            });

            // Assert
            expect(result.url).toBe(MOCK_UPLOAD_RESPONSE.secure_url);
            expect(endedWith).toBeDefined();
            expect(Buffer.isBuffer(endedWith)).toBe(true);
            expect(endedWith?.equals(buffer)).toBe(true);
        });

        // GAP-078-085: remote URL input shape.
        // The provider only accepts Buffer inputs, so a "remote URL" upload is
        // modelled by the caller fetching the URL into a Buffer first. The
        // assertion here is that the same Buffer the caller produced is what
        // the SDK ultimately writes downstream — no string passthrough exists.
        it('should upload a Buffer fetched from a remote URL source', async () => {
            // Arrange — simulate a `fetch(url).then(r => r.arrayBuffer())` result.
            const remoteBytes = new Uint8Array([
                0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xde, 0xad, 0xbe, 0xef
            ]);
            const buffer = Buffer.from(remoteBytes);

            let endedWith: Buffer | undefined;
            mockUploadStream.mockImplementation(
                (
                    _options: Record<string, unknown>,
                    callback: (err: Error | null, result: unknown) => void
                ) => ({
                    on: vi.fn(),
                    end: vi.fn((chunk: Buffer) => {
                        endedWith = chunk;
                        setImmediate(callback, null, MOCK_UPLOAD_RESPONSE);
                    })
                })
            );
            const provider = new CloudinaryProvider(VALID_CONFIG);

            // Act
            const result = await provider.upload({
                file: buffer,
                folder: 'hospeda/prod/accommodations/abc-123/imported'
            });

            // Assert
            expect(result.publicId).toBe(MOCK_UPLOAD_RESPONSE.public_id);
            expect(endedWith).toBeDefined();
            expect(endedWith?.equals(buffer)).toBe(true);
        });

        // GAP-078-217: SDK call must include resource_type: 'image'.
        // Cloudinary's `upload_stream` defaults to `resource_type: 'image'` when
        // omitted, but we forward it explicitly so the contract is impossible to
        // accidentally break by relying on SDK defaults.
        it("should forward resource_type: 'image' to the upload_stream SDK call", async () => {
            // Arrange
            setupUploadStream(null, MOCK_UPLOAD_RESPONSE);
            const provider = new CloudinaryProvider(VALID_CONFIG);

            // Act
            await provider.upload({
                file: Buffer.from('fake-image'),
                folder: 'hospeda/prod/accommodations/abc-123'
            });

            // Assert — first arg of the first call is the options object.
            const callOptions = mockUploadStream.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(callOptions).toBeDefined();
            expect(callOptions.resource_type).toBe('image');
        });

        // GAP-078-219: empty tags array must not be forwarded to the SDK and
        // must not throw. The provider explicitly skips the `tags` option when
        // the array is empty, since Cloudinary rejects `tags: ''` in some SDK
        // versions and there is no semantic difference between `[]` and "no
        // tags supplied".
        it('should resolve successfully when tags is an empty array', async () => {
            // Arrange
            setupUploadStream(null, MOCK_UPLOAD_RESPONSE);
            const provider = new CloudinaryProvider(VALID_CONFIG);

            // Act
            const result = await provider.upload({
                file: Buffer.from('fake-image'),
                folder: 'hospeda/prod/accommodations/abc-123',
                tags: []
            });

            // Assert — call resolves AND tags is not forwarded as an empty array.
            expect(result.url).toBe(MOCK_UPLOAD_RESPONSE.secure_url);
            const callOptions = mockUploadStream.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(callOptions).toBeDefined();
            expect(callOptions.tags).toBeUndefined();
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

        // SPEC-078-GAPS GAP-078-087: 429 rate-limit should retry then succeed
        it('should retry once on a 429 rate-limit and resolve on the second attempt', async () => {
            // Arrange
            vi.useFakeTimers();
            const rateLimitError = Object.assign(new Error('Too Many Requests'), {
                http_code: 429
            });
            mockDestroy
                .mockRejectedValueOnce(rateLimitError)
                .mockResolvedValueOnce({ result: 'ok' });
            const provider = new CloudinaryProvider(VALID_CONFIG);

            // Act
            const promise = provider.delete({ publicId: 'hospeda/prod/abc/featured' });
            // Drain p-retry's internal setTimeout backoff
            await vi.runAllTimersAsync();
            const result = await promise;
            vi.useRealTimers();

            // Assert
            expect(mockDestroy).toHaveBeenCalledTimes(2);
            expect(result).toEqual({ wasPresent: true });
        });

        // SPEC-078-GAPS GAP-078-087: permanent 4xx (e.g. 401) must NOT retry
        it('should NOT retry on a permanent 4xx error such as 401 and reject immediately', async () => {
            // Arrange
            const error = Object.assign(new Error('Unauthorized'), { http_code: 401 });
            mockDestroy.mockRejectedValue(error);
            const provider = new CloudinaryProvider(VALID_CONFIG);

            // Act + Assert
            await expect(
                provider.delete({ publicId: 'hospeda/prod/abc/featured' })
            ).rejects.toThrow('Unauthorized');
            expect(mockDestroy).toHaveBeenCalledTimes(1);
        });

        // SPEC-078-GAPS GAP-078-154: present asset → wasPresent: true
        it('should return wasPresent: true when Cloudinary reports result === "ok"', async () => {
            mockDestroy.mockResolvedValue({ result: 'ok' });
            const provider = new CloudinaryProvider(VALID_CONFIG);

            const result = await provider.delete({
                publicId: 'hospeda/prod/accommodations/abc-123/featured'
            });

            expect(result).toEqual({ wasPresent: true });
        });

        it('should not throw when Cloudinary returns not found (idempotent delete)', async () => {
            mockDestroy.mockResolvedValue({ result: 'not found' });
            const provider = new CloudinaryProvider(VALID_CONFIG);

            await expect(
                provider.delete({ publicId: 'hospeda/prod/does-not-exist' })
            ).resolves.toEqual({ wasPresent: false });
        });

        // SPEC-078-GAPS GAP-078-154: absent asset → wasPresent: false
        it('should return wasPresent: false when Cloudinary reports result === "not found"', async () => {
            mockDestroy.mockResolvedValue({ result: 'not found' });
            const provider = new CloudinaryProvider(VALID_CONFIG);

            const result = await provider.delete({ publicId: 'hospeda/prod/does-not-exist' });

            expect(result).toEqual({ wasPresent: false });
        });

        // Defensive: any unexpected result string maps to wasPresent: false
        // so the caller still gets a consistent boolean signal.
        it('should default wasPresent to false when Cloudinary response is missing or unexpected', async () => {
            mockDestroy.mockResolvedValue(undefined);
            const provider = new CloudinaryProvider(VALID_CONFIG);

            const result = await provider.delete({
                publicId: 'hospeda/prod/accommodations/abc/featured'
            });

            expect(result).toEqual({ wasPresent: false });
        });
    });

    // -------------------------------------------------------------------------
    // deleteByPrefix()
    // -------------------------------------------------------------------------

    describe('deleteByPrefix()', () => {
        // SPEC-078-GAPS GAP-078-054: must pass { invalidate: true } so the
        // CDN cache is purged immediately for every removed asset.
        it('should call cloudinary.api.delete_resources_by_prefix with prefix and invalidate flag', async () => {
            mockDeleteByPrefix.mockResolvedValue({ deleted: {} });
            const provider = new CloudinaryProvider(VALID_CONFIG);

            await provider.deleteByPrefix({
                prefix: 'hospeda/prod/accommodations/abc-123/'
            });

            expect(mockDeleteByPrefix).toHaveBeenCalledOnce();
            expect(mockDeleteByPrefix).toHaveBeenCalledWith(
                'hospeda/prod/accommodations/abc-123/',
                { invalidate: true }
            );
        });
    });

    // -------------------------------------------------------------------------
    // healthCheck() — SPEC-078-GAPS GAP-078-232
    // -------------------------------------------------------------------------

    describe('healthCheck()', () => {
        it('should return {ok: true} when cloudinary.api.ping() resolves with status: "ok"', async () => {
            // Arrange
            mockPing.mockResolvedValue({ status: 'ok' });
            const provider = new CloudinaryProvider(VALID_CONFIG);

            // Act
            const result = await provider.healthCheck();

            // Assert
            expect(result).toEqual({ ok: true });
            expect(mockPing).toHaveBeenCalledOnce();
        });

        it('should return {ok: false} with the SDK error message when ping rejects', async () => {
            // Arrange
            const sdkError = Object.assign(new Error('Invalid API key'), { http_code: 401 });
            mockPing.mockRejectedValue(sdkError);
            const provider = new CloudinaryProvider(VALID_CONFIG);

            // Act
            const result = await provider.healthCheck();

            // Assert
            expect(result.ok).toBe(false);
            expect(result.message).toContain('Invalid API key');
            expect(result.message).toContain('http_code=401');
        });

        it('should not upload, list, or mutate any asset', async () => {
            // Arrange
            mockPing.mockResolvedValue({ status: 'ok' });
            const provider = new CloudinaryProvider(VALID_CONFIG);

            // Act
            await provider.healthCheck();

            // Assert
            expect(mockUploadStream).not.toHaveBeenCalled();
            expect(mockDestroy).not.toHaveBeenCalled();
            expect(mockDeleteByPrefix).not.toHaveBeenCalled();
        });

        it('should return {ok: false} when ping returns an unexpected payload', async () => {
            // Arrange
            mockPing.mockResolvedValue({ status: 'degraded' });
            const provider = new CloudinaryProvider(VALID_CONFIG);

            // Act
            const result = await provider.healthCheck();

            // Assert
            expect(result.ok).toBe(false);
            expect(result.message).toContain('degraded');
        });

        it('should sanitize non-Error rejections', async () => {
            // Arrange
            mockPing.mockRejectedValue('something exploded');
            const provider = new CloudinaryProvider(VALID_CONFIG);

            // Act
            const result = await provider.healthCheck();

            // Assert
            expect(result).toEqual({ ok: false, message: 'something exploded' });
        });
    });
});
