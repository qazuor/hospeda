import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function flattenObject(
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    obj: Record<string, any>,
    parentKey = '',
    result: Record<string, string> = {}
) {
    for (const key in obj) {
        const newKey = parentKey ? `${parentKey}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            flattenObject(obj[key], newKey, result);
        } else {
            result[newKey] = obj[key];
        }
    }
    return result;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesPath = path.resolve(__dirname, '../src/i18n/locales/es');
const files = fs.readdirSync(localesPath);

const result: Record<string, string> = {};

for (const file of files) {
    const filePath = path.join(localesPath, file);
    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    flattenObject(json, path.basename(file, '.json'), result);
}

// biome-ignore lint/suspicious/noConsoleLog: <explanation>
console.log(result, 'result');

const keys = Object.keys(result);
const output = `export type TranslationKeys = ${keys.map((k) => `'${k}'`).join(' | ')};`;

fs.writeFileSync(path.resolve(__dirname, '../src/i18n/translation-keys.ts'), output);
