import exampleManifest from '../manifest-example.json';
import requiredManifest from '../manifest-required.json';
import { STATUS_ICONS } from './icons.js';
import { logger } from './logger.js';
import { validateManifestVsFolder } from './validateManifestVsFolder.js';

/**
 * Validates all manifests against their corresponding folders.
 * This function should be called once at the beginning of the seeding process.
 *
 * @param {boolean} continueOnError - Whether to continue on validation errors
 * @returns {Promise<void>}
 *
 * @example
 * ```ts
 * import { validateAllManifests } from './utils/validateAllManifests.js';
 *
 * // Validate all manifests before starting seeding
 * await validateAllManifests(false);
 * ```
 */
export async function validateAllManifests(continueOnError = false): Promise<void> {
    const separator = '#'.repeat(90);
    const subSeparator = '─'.repeat(90);

    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log('\n');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Debug} VALIDATING MANIFESTS AGAINST FILES`);
    logger.info(`${subSeparator}`);

    const manifests = [
        { name: 'Required', manifest: requiredManifest, type: 'required' },
        { name: 'Example', manifest: exampleManifest, type: 'example' }
    ];

    let totalValidations = 0;
    let totalErrors = 0;

    for (const { name, manifest, type } of manifests) {
        logger.info(`📁 Validating ${name} (${Object.keys(manifest).length} entities)`);

        for (const [entityName, files] of Object.entries(manifest)) {
            totalValidations++;

            try {
                // Ensure 'type' is correctly typed as 'required' | 'example'
                if (type !== 'required' && type !== 'example') {
                    throw new Error(`Invalid manifest type: ${type}`);
                }
                await validateManifestVsFolder(entityName, files, type);
                logger.success({
                    msg: `${STATUS_ICONS.Success} ${entityName}: ${files.length} files validated`
                });
            } catch (error) {
                totalErrors++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error(`${STATUS_ICONS.Error} ${entityName}: ${errorMessage}`);

                if (!continueOnError) {
                    throw error;
                }
            }
        }
        logger.info(`${subSeparator}`);
    }

    logger.info(`${subSeparator}`);

    if (totalErrors === 0) {
        logger.success({ msg: `${STATUS_ICONS.Success} All manifests validated successfully` });
    } else {
        logger.warn(
            `${STATUS_ICONS.Warning}  ${totalValidations - totalErrors} successful validations, ${totalErrors} errors`
        );
    }

    logger.info(`${separator}\n`);
}
