#!/usr/bin/env node
import { runSeed } from './index.js';
import { STATUS_ICONS } from './utils/icons.js';
import { logger } from './utils/logger.js';

// Parseo básico de argumentos CLI
const args = process.argv.slice(2);

const options = {
    required: args.includes('--required'),
    example: args.includes('--example'),
    reset: args.includes('--reset'),
    migrate: args.includes('--migrate'),
    rollbackOnError: args.includes('--rollbackOnError'),
    continueOnError: args.includes('--continueOnError'),
    exclude: [] as string[]
};

// Validación de flags incompatibles
if (options.rollbackOnError && options.continueOnError) {
    logger.error(
        `${STATUS_ICONS.Error} No se puede usar --rollbackOnError y --continueOnError al mismo tiempo.`
    );
    process.exit(1);
}

// Parseo de --exclude roles,permissions
const excludeArg = args.find((arg) => arg.startsWith('--exclude='));
if (excludeArg) {
    const list = excludeArg.replace('--exclude=', '');
    options.exclude = list.split(',').map((s) => s.trim());
}

try {
    runSeed(options);
} catch (err) {
    // 🔍 LOG DISTINTIVO: cli principal
    console.error(`${STATUS_ICONS.Debug} [CLI_PRINCIPAL] Error en el nivel principal del proceso`);

    logger.error('🧨 Error durante el proceso de seed:');
    logger.error(String(err));
    process.exit(1);
}
