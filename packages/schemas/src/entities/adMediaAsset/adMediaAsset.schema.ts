import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { AdMediaAssetIdSchema } from '../../common/id.schema.js';

/**
 * Ad Media Asset Schema
 *
 * Defines media assets used in advertising campaigns including images, videos,
 * interactive content with validation, optimization, and performance tracking.
 */
export const AdMediaAssetSchema = z
    .object({
        // Base fields
        id: AdMediaAssetIdSchema,
        ...BaseAuditFields,

        // Asset identification
        name: z
            .string()
            .min(3, { message: 'zodError.adMediaAsset.name.tooShort' })
            .max(200, { message: 'zodError.adMediaAsset.name.tooLong' })
            .describe('Asset name for identification'),

        description: z
            .string()
            .min(10, { message: 'zodError.adMediaAsset.description.tooShort' })
            .max(1000, { message: 'zodError.adMediaAsset.description.tooLong' })
            .describe('Detailed description of the media asset'),

        // Media type and format
        mediaType: z
            .enum(['image', 'video', 'gif', 'interactive', 'audio', 'document'])
            .describe('Type of media asset'),

        format: z
            .object({
                mimeType: z
                    .string()
                    .regex(/^[a-z]+\/[a-z0-9\-\+\.]+$/, {
                        message: 'zodError.adMediaAsset.format.mimeType.invalid'
                    })
                    .describe('MIME type of the asset'),

                fileExtension: z
                    .string()
                    .regex(/^\.[a-z0-9]+$/, {
                        message: 'zodError.adMediaAsset.format.fileExtension.invalid'
                    })
                    .describe('File extension including the dot'),

                encoding: z.string().max(50).optional().describe('Encoding format for the asset'),

                compression: z
                    .object({
                        algorithm: z
                            .enum(['none', 'gzip', 'webp', 'h264', 'h265', 'av1'])
                            .optional(),
                        quality: z.number().min(0).max(100).optional(),
                        lossless: z.boolean().default(false)
                    })
                    .optional()
                    .describe('Compression settings for the asset')
            })
            .describe('Media format specifications'),

        // File properties
        file: z
            .object({
                originalFileName: z
                    .string()
                    .min(1, { message: 'zodError.adMediaAsset.file.originalFileName.required' })
                    .max(255, { message: 'zodError.adMediaAsset.file.originalFileName.tooLong' })
                    .describe('Original filename when uploaded'),

                fileSize: z
                    .number()
                    .int()
                    .min(1, { message: 'zodError.adMediaAsset.file.fileSize.tooSmall' })
                    .max(100 * 1024 * 1024, {
                        message: 'zodError.adMediaAsset.file.fileSize.tooLarge'
                    }) // 100MB max
                    .describe('File size in bytes'),

                checksum: z
                    .string()
                    .regex(/^[a-f0-9]{32,128}$/, {
                        message: 'zodError.adMediaAsset.file.checksum.invalid'
                    })
                    .describe('File checksum for integrity verification'),

                url: z
                    .string()
                    .url({ message: 'zodError.adMediaAsset.file.url.invalid' })
                    .describe('URL where the asset is stored'),

                thumbnailUrl: z
                    .string()
                    .url({ message: 'zodError.adMediaAsset.file.thumbnailUrl.invalid' })
                    .optional()
                    .describe('URL for asset thumbnail/preview'),

                cdnUrl: z
                    .string()
                    .url({ message: 'zodError.adMediaAsset.file.cdnUrl.invalid' })
                    .optional()
                    .describe('CDN URL for optimized delivery')
            })
            .describe('File storage and access information'),

        // Dimensions and visual properties
        dimensions: z
            .object({
                width: z
                    .number()
                    .int()
                    .min(1, { message: 'zodError.adMediaAsset.dimensions.width.tooSmall' })
                    .max(10000, { message: 'zodError.adMediaAsset.dimensions.width.tooLarge' })
                    .describe('Asset width in pixels'),

                height: z
                    .number()
                    .int()
                    .min(1, { message: 'zodError.adMediaAsset.dimensions.height.tooSmall' })
                    .max(10000, { message: 'zodError.adMediaAsset.dimensions.height.tooLarge' })
                    .describe('Asset height in pixels'),

                aspectRatio: z
                    .string()
                    .regex(/^\d+:\d+$/, {
                        message: 'zodError.adMediaAsset.dimensions.aspectRatio.invalid'
                    })
                    .describe('Aspect ratio (e.g., "16:9", "1:1")'),

                resolution: z
                    .enum(['low', 'medium', 'high', 'ultra'])
                    .default('medium')
                    .describe('Visual resolution quality'),

                colorProfile: z
                    .string()
                    .max(50)
                    .optional()
                    .describe('Color profile (e.g., sRGB, Adobe RGB)'),

                hasTransparency: z
                    .boolean()
                    .default(false)
                    .describe('Whether the asset has transparent areas')
            })
            .optional()
            .describe('Visual dimensions and properties'),

        // Video/animation specific properties
        media: z
            .object({
                duration: z
                    .number()
                    .positive({ message: 'zodError.adMediaAsset.media.duration.mustBePositive' })
                    .max(300, { message: 'zodError.adMediaAsset.media.duration.tooLong' }) // 5 minutes max
                    .optional()
                    .describe('Duration in seconds (for video/audio)'),

                frameRate: z
                    .number()
                    .positive()
                    .max(120)
                    .optional()
                    .describe('Frame rate for video content'),

                bitrate: z.number().positive().optional().describe('Bitrate in kbps'),

                isLooped: z
                    .boolean()
                    .default(false)
                    .describe('Whether video/animation should loop'),

                hasAudio: z.boolean().default(false).describe('Whether the asset contains audio'),

                autoplay: z.boolean().default(false).describe('Whether the asset should autoplay'),

                controls: z.boolean().default(true).describe('Whether to show media controls')
            })
            .optional()
            .describe('Media-specific properties for video/audio assets'),

        // Usage and licensing
        usage: z
            .object({
                license: z
                    .enum([
                        'commercial',
                        'royalty_free',
                        'creative_commons',
                        'proprietary',
                        'exclusive'
                    ])
                    .describe('Usage license type'),

                restrictions: z
                    .array(
                        z.enum([
                            'no_modification',
                            'attribution_required',
                            'non_commercial',
                            'geographic_limited',
                            'time_limited'
                        ])
                    )
                    .max(5)
                    .default([])
                    .describe('Usage restrictions'),

                copyrightInfo: z
                    .string()
                    .max(500)
                    .optional()
                    .describe('Copyright information and attribution'),

                licenseExpiry: z.date().optional().describe('When the license expires'),

                usageCount: z
                    .number()
                    .int()
                    .min(0)
                    .default(0)
                    .describe('Number of times this asset has been used'),

                maxUsageCount: z
                    .number()
                    .int()
                    .positive()
                    .optional()
                    .describe('Maximum allowed uses (if applicable)')
            })
            .describe('Usage rights and licensing information'),

        // Technical specifications
        technical: z
            .object({
                isOptimized: z
                    .boolean()
                    .default(false)
                    .describe('Whether the asset has been optimized for web'),

                supportedDevices: z
                    .array(z.enum(['desktop', 'mobile', 'tablet']))
                    .min(1, {
                        message: 'zodError.adMediaAsset.technical.supportedDevices.minRequired'
                    })
                    .default(['desktop', 'mobile', 'tablet'])
                    .describe('Devices that support this asset'),

                browserCompatibility: z
                    .array(z.enum(['chrome', 'firefox', 'safari', 'edge', 'opera']))
                    .min(1, {
                        message: 'zodError.adMediaAsset.technical.browserCompatibility.minRequired'
                    })
                    .default(['chrome', 'firefox', 'safari', 'edge'])
                    .describe('Browser compatibility'),

                loadingPriority: z
                    .enum(['high', 'medium', 'low'])
                    .default('medium')
                    .describe('Loading priority for performance optimization'),

                lazyLoadEnabled: z
                    .boolean()
                    .default(true)
                    .describe('Whether lazy loading is enabled'),

                preloadStrategy: z
                    .enum(['none', 'metadata', 'auto'])
                    .default('metadata')
                    .describe('Preload strategy for media assets'),

                cacheability: z
                    .object({
                        cacheable: z.boolean().default(true),
                        maxAge: z.number().int().min(0).default(86400), // 24 hours
                        etag: z.string().optional(),
                        lastModified: z.date().optional()
                    })
                    .optional()
                    .describe('Caching configuration')
            })
            .describe('Technical specifications and performance settings'),

        // Content and brand safety
        content: z
            .object({
                categories: z
                    .array(
                        z.enum([
                            'fashion',
                            'travel',
                            'food',
                            'technology',
                            'lifestyle',
                            'business',
                            'health',
                            'entertainment'
                        ])
                    )
                    .max(5)
                    .default([])
                    .describe('Content categories'),

                tags: z
                    .array(z.string().max(50))
                    .max(20, { message: 'zodError.adMediaAsset.content.tags.tooMany' })
                    .default([])
                    .describe('Content tags for organization'),

                language: z
                    .string()
                    .length(2)
                    .optional()
                    .describe('Primary language of the content'),

                isAdultContent: z
                    .boolean()
                    .default(false)
                    .describe('Whether content is for adult audiences only'),

                brandSafety: z
                    .object({
                        isApproved: z.boolean().default(false),
                        riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
                        reviewedBy: z.string().optional(),
                        reviewedAt: z.date().optional(),
                        notes: z.string().max(500).optional()
                    })
                    .optional()
                    .describe('Brand safety review information'),

                accessibility: z
                    .object({
                        hasAltText: z.boolean().default(false),
                        altText: z.string().max(200).optional(),
                        hasClosedCaptions: z.boolean().default(false),
                        captionsUrl: z.string().url().optional(),
                        isScreenReaderFriendly: z.boolean().default(false)
                    })
                    .optional()
                    .describe('Accessibility features')
            })
            .describe('Content categorization and safety'),

        // Performance tracking
        performance: z
            .object({
                totalViews: z.number().int().min(0).default(0).describe('Total number of views'),

                totalClicks: z.number().int().min(0).default(0).describe('Total number of clicks'),

                averageViewDuration: z
                    .number()
                    .min(0)
                    .default(0)
                    .describe('Average view duration in seconds'),

                engagementRate: z
                    .number()
                    .min(0)
                    .max(1)
                    .default(0)
                    .describe('Engagement rate (clicks/views)'),

                conversionRate: z
                    .number()
                    .min(0)
                    .max(1)
                    .default(0)
                    .describe('Conversion rate for campaigns using this asset'),

                lastUsed: z
                    .date()
                    .optional()
                    .describe('When the asset was last used in a campaign'),

                performanceScore: z
                    .number()
                    .min(0)
                    .max(10)
                    .default(5)
                    .describe('Overall performance score based on metrics')
            })
            .optional()
            .describe('Performance metrics and analytics'),

        // Status and lifecycle
        status: z
            .enum(['draft', 'processing', 'approved', 'active', 'inactive', 'archived', 'rejected'])
            .describe('Asset status'),

        // Metadata
        metadata: z
            .object({
                uploadedBy: z.string().describe('User ID who uploaded the asset'),

                source: z
                    .enum(['upload', 'generated', 'stock', 'template', 'external'])
                    .describe('How the asset was created'),

                campaign: z.string().optional().describe('Campaign ID this asset was created for'),

                variations: z
                    .array(
                        z.object({
                            name: z.string().max(100),
                            url: z.string().url(),
                            dimensions: z.object({
                                width: z.number().int().positive(),
                                height: z.number().int().positive()
                            }),
                            purpose: z.enum(['thumbnail', 'mobile', 'retina', 'print'])
                        })
                    )
                    .max(10)
                    .default([])
                    .describe('Asset variations and sizes'),

                externalId: z
                    .string()
                    .max(100)
                    .optional()
                    .describe('External ID from third-party systems'),

                notes: z.string().max(1000).optional().describe('Internal notes about the asset')
            })
            .optional()
            .describe('Asset metadata and additional information')
    })
    .refine(
        (data) => {
            // Video/animation assets must have duration
            if (['video', 'gif'].includes(data.mediaType) && !data.media?.duration) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.adMediaAsset.media.durationRequired',
            path: ['media', 'duration']
        }
    )
    .refine(
        (data) => {
            // Interactive assets must have dimensions
            if (data.mediaType === 'interactive' && !data.dimensions) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.adMediaAsset.dimensions.requiredForInteractive',
            path: ['dimensions']
        }
    )
    .refine(
        (data) => {
            // Check usage count against max if specified
            if (data.usage.maxUsageCount && data.usage.usageCount >= data.usage.maxUsageCount) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.adMediaAsset.usage.maxUsageExceeded',
            path: ['usage', 'usageCount']
        }
    );

export type AdMediaAsset = z.infer<typeof AdMediaAssetSchema>;
