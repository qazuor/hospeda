import { z } from 'zod';
import { MediaAssetTypeEnum } from './media-asset-type.enum';

export const MediaAssetTypeSchema = z.nativeEnum(MediaAssetTypeEnum, {
    message: 'zodError.enums.mediaAssetType.invalid'
});
