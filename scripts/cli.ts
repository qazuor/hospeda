/**
 * Entry point for the Hospeda interactive CLI tool.
 * Run with: pnpm cli
 */
import { main } from './cli/main.js';

main().then((code) => process.exit(code));
