#!/usr/bin/env tsx
/**
 * Schema Validation Script
 *
 * Validates JSON files and markdown frontmatter against JSON schemas.
 * Uses ajv for schema validation.
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - Validation failed
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Initialize ajv with formats (for date-time, uri, etc.)
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Counters
let totalFiles = 0;
let validFiles = 0;
let invalidFiles = 0;
const errors: Array<{ file: string; path?: string; error: string }> = [];

// Directories
const SCHEMAS_DIR = resolve(process.cwd(), '.claude/schemas');
const PLANNING_DIR = resolve(process.cwd(), '.claude/sessions/planning');

// Schema mappings: filename pattern -> schema file
const SCHEMA_MAPPINGS: Record<string, string> = {
  'PDR.md': 'pdr.schema.json',
  'tech-analysis.md': 'tech-analysis.schema.json',
  'TODOs.md': 'todos.schema.json',
  'problems.md': 'problems.schema.json',
  '.checkpoint.json': 'checkpoint.schema.json',
  '.code-registry.json': 'code-registry.schema.json'
};

// Schema cache
const schemaCache = new Map<string, ReturnType<typeof ajv.compile>>();

/**
 * Load and compile a JSON schema (with caching)
 */
function loadSchema(schemaFile: string) {
  // Return cached schema if exists
  if (schemaCache.has(schemaFile)) {
    return schemaCache.get(schemaFile)!;
  }
  try {
    const schemaPath = join(SCHEMAS_DIR, schemaFile);
    const schemaData = readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaData);
    const compiled = ajv.compile(schema);

    // Cache the compiled schema
    schemaCache.set(schemaFile, compiled);

    return compiled;
  } catch (error) {
    console.error(`❌ Error loading schema ${schemaFile}:`, error);
    return null;
  }
}

/**
 * Extract frontmatter from markdown file
 */
function extractFrontmatter(content: string): Record<string, string> | null {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  try {
    // Simple YAML-like parsing (supports basic key: value pairs)
    const yamlContent = match[1];
    const data: Record<string, string> = {};

    yamlContent.split('\n').forEach((line) => {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();

        // Remove quotes if present
        data[key] = value.replace(/^["']|["']$/g, '');
      }
    });

    return data;
  } catch (error) {
    console.error('  Error parsing frontmatter:', error);
    return null;
  }
}

/**
 * Validate a JSON file against a schema
 */
function validateJsonFile(filePath: string, schemaFile: string): boolean {
  totalFiles++;

  const validate = loadSchema(schemaFile);
  if (!validate) {
    invalidFiles++;
    errors.push({ file: filePath, error: `Schema ${schemaFile} not found or invalid` });
    return false;
  }

  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    const valid = validate(data);

    if (valid) {
      validFiles++;
      console.log(`  ✓ ${basename(filePath)}`);
      return true;
    }

    invalidFiles++;
    console.log(`  ✗ ${basename(filePath)}`);

    if (validate.errors) {
      validate.errors.forEach((error) => {
        console.log(`    → ${error.instancePath || '/'}: ${error.message}`);
        errors.push({
          file: filePath,
          path: error.instancePath,
          error: error.message || 'Unknown error'
        });
      });
    }

    return false;
  } catch (error) {
    invalidFiles++;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`  ✗ ${basename(filePath)} - ${errorMessage}`);
    errors.push({ file: filePath, error: errorMessage });
    return false;
  }
}

/**
 * Validate a markdown file's frontmatter
 */
function validateMarkdownFile(filePath: string, schemaFile: string): boolean {
  totalFiles++;

  const validate = loadSchema(schemaFile);
  if (!validate) {
    invalidFiles++;
    errors.push({ file: filePath, error: `Schema ${schemaFile} not found or invalid` });
    return false;
  }

  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    const frontmatter = extractFrontmatter(fileContent);

    if (!frontmatter) {
      console.log(`  ⚠ ${basename(filePath)} - No frontmatter found (skipping)`);
      totalFiles--; // Don't count files without frontmatter
      return true;
    }

    const valid = validate(frontmatter);

    if (valid) {
      validFiles++;
      console.log(`  ✓ ${basename(filePath)}`);
      return true;
    }

    invalidFiles++;
    console.log(`  ✗ ${basename(filePath)}`);

    if (validate.errors) {
      validate.errors.forEach((error) => {
        console.log(`    → ${error.instancePath || '/'}: ${error.message}`);
        errors.push({
          file: filePath,
          path: error.instancePath,
          error: error.message || 'Unknown error'
        });
      });
    }

    return false;
  } catch (error) {
    invalidFiles++;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`  ✗ ${basename(filePath)} - ${errorMessage}`);
    errors.push({ file: filePath, error: errorMessage });
    return false;
  }
}

/**
 * Find all files matching a pattern in a directory
 */
function findFiles(baseDir: string, pattern: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        if (entry.name === pattern || entry.name.endsWith(pattern)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(baseDir);
  return results;
}

/**
 * Main validation logic
 */
function main() {
  console.log('🔍 Validating schemas...\n');

  // Validate each file type
  for (const [filePattern, schemaFile] of Object.entries(SCHEMA_MAPPINGS)) {
    console.log(`📄 Validating ${filePattern} files against ${schemaFile}...`);

    const files = findFiles(PLANNING_DIR, filePattern);

    if (files.length === 0) {
      console.log('  (No files found)\n');
      continue;
    }

    files.forEach((file) => {
      if (file.endsWith('.json')) {
        validateJsonFile(file, schemaFile);
      } else if (file.endsWith('.md')) {
        validateMarkdownFile(file, schemaFile);
      }
    });

    console.log('');
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  if (invalidFiles === 0) {
    console.log('✅ All validations passed!');
    console.log(`   Total files: ${totalFiles}`);
    console.log(`   Valid: ${validFiles}`);
    process.exit(0);
  }

  console.log('❌ Validation failed!');
  console.log(`   Total files: ${totalFiles}`);
  console.log(`   Valid: ${validFiles}`);
  console.log(`   Invalid: ${invalidFiles}`);
  console.log(`   Errors: ${errors.length}`);
  process.exit(1);
}

main();
