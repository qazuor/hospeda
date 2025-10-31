---
name: json-data-auditor
category: utils
description: JSON data validation, transformation, and auditing specialist for data quality and consistency
usage: Use to validate JSON data, transform structures, audit data quality, or ensure schema compliance
input: JSON data, validation schemas, transformation rules, quality criteria
output: Validated data, transformation results, audit reports, data quality metrics
---

# JSON Data Auditor

## Overview

**Purpose**: Validate, transform, and audit JSON data for quality, consistency, and schema compliance across the application

**Category**: Utils
**Primary Users**: qa-engineer, tech-lead, db-engineer, hono-engineer

## When to Use This Skill

- Validating API request/response data
- Auditing database export/import data
- Transforming data between formats
- Checking data quality and consistency
- Validating configuration files
- Analyzing data structure patterns
- Finding data anomalies
- Ensuring schema compliance

## Prerequisites

**Required:**

- JSON data to audit/validate
- Validation criteria or schema
- Understanding of expected structure

**Optional:**

- Zod schemas for validation
- Transformation requirements
- Data quality metrics

## Input

**What the skill needs:**

- **JSON Data**: Data to validate/audit
- **Schema**: Expected structure (Zod or JSON Schema)
- **Rules**: Validation and quality rules
- **Context**: Data source and purpose

## Workflow

### Step 1: Data Structure Analysis

**Objective**: Analyze JSON structure and identify patterns

**Actions:**

1. **Parse and inspect JSON**:

```typescript
interface DataAnalysis {
  totalRecords: number;
  structure: object;
  types: Record<string, string>;
  nullable: string[];
  unique: string[];
  patterns: Record<string, string>;
}

export function analyzeJSON(data: unknown): DataAnalysis {
  if (Array.isArray(data)) {
    return analyzeArray(data);
  }
  
  if (typeof data === 'object' && data !== null) {
    return analyzeObject(data);
  }
  
  throw new Error('Invalid JSON data');
}

function analyzeArray(arr: unknown[]): DataAnalysis {
  if (arr.length === 0) {
    return {
      totalRecords: 0,
      structure: {},
      types: {},
      nullable: [],
      unique: [],
      patterns: {}
    };
  }

  const sample = arr[0];
  const structure: Record<string, unknown> = {};
  const types: Record<string, string> = {};
  const nullable: string[] = [];
  const unique: string[] = [];
  const patterns: Record<string, string> = {};

  if (typeof sample === 'object' && sample !== null) {
    Object.keys(sample).forEach(key => {
      const values = arr.map(item => 
        (item as Record<string, unknown>)[key]
      );

      types[key] = detectType(values);
      
      if (values.some(v => v === null || v === undefined)) {
        nullable.push(key);
      }

      if (new Set(values).size === values.length) {
        unique.push(key);
      }

      patterns[key] = detectPattern(values);
    });
  }

  return {
    totalRecords: arr.length,
    structure: sample,
    types,
    nullable,
    unique,
    patterns
  };
}

function detectType(values: unknown[]): string {
  const types = new Set(
    values
      .filter(v => v !== null && v !== undefined)
      .map(v => typeof v)
  );

  if (types.size === 1) {
    return Array.from(types)[0];
  }

  return 'mixed';
}

function detectPattern(values: unknown[]): string {
  const stringValues = values.filter(
    v => typeof v === 'string'
  ) as string[];

  if (stringValues.length === 0) return 'n/a';

  // Email pattern
  if (stringValues.every(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) {
    return 'email';
  }

  // UUID pattern
  if (stringValues.every(v => 
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  )) {
    return 'uuid';
  }

  // Date pattern
  if (stringValues.every(v => !isNaN(Date.parse(v)))) {
    return 'date';
  }

  return 'string';
}
```

**Validation:**

- [ ] Structure identified
- [ ] Types detected
- [ ] Patterns recognized
- [ ] Anomalies flagged

**Output**: Data structure analysis

### Step 2: Schema Validation

**Objective**: Validate data against Zod schema

**Actions:**

```typescript
import { z } from 'zod';

interface ValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    code: string;
  }>;
  validRecords: number;
  invalidRecords: number;
}

export function validateWithZod<T>(
  data: unknown[],
  schema: z.ZodSchema<T>
): ValidationResult {
  const results = data.map((item, index) => ({
    index,
    result: schema.safeParse(item)
  }));

  const errors = results
    .filter(r => !r.result.success)
    .flatMap(r => {
      if (!r.result.success) {
        return r.result.error.errors.map(err => ({
          path: `[${r.index}].${err.path.join('.')}`,
          message: err.message,
          code: err.code
        }));
      }
      return [];
    });

  return {
    valid: errors.length === 0,
    errors,
    validRecords: results.filter(r => r.result.success).length,
    invalidRecords: results.filter(r => !r.result.success).length
  };
}

// Example usage
const bookingSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  accommodationId: z.string().uuid(),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guests: z.number().int().positive(),
  status: z.enum(['pending', 'confirmed', 'cancelled']),
  totalPrice: z.number().positive()
});

const result = validateWithZod(bookingsData, bookingSchema);

if (!result.valid) {
  console.log(`Found ${result.errors.length} validation errors:`);
  result.errors.forEach(err => {
    console.log(`  ${err.path}: ${err.message}`);
  });
}
```

**Validation:**

- [ ] Schema applied correctly
- [ ] All errors captured
- [ ] Error messages clear
- [ ] Validation results actionable

**Output**: Schema validation results

### Step 3: Data Quality Audit

**Objective**: Check data quality metrics

**Actions:**

```typescript
interface DataQualityReport {
  completeness: number;
  uniqueness: Record<string, number>;
  consistency: Record<string, boolean>;
  validity: Record<string, number>;
  accuracy: Record<string, number>;
  metrics: {
    totalRecords: number;
    completeRecords: number;
    duplicateRecords: number;
    invalidRecords: number;
  };
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    field: string;
    message: string;
    count: number;
  }>;
}

export function auditDataQuality(
  data: Record<string, unknown>[],
  requiredFields: string[]
): DataQualityReport {
  const issues: Array<{
    severity: 'error' | 'warning' | 'info';
    field: string;
    message: string;
    count: number;
  }> = [];

  // Completeness check
  const completeRecords = data.filter(record =>
    requiredFields.every(field => 
      record[field] !== null && 
      record[field] !== undefined &&
      record[field] !== ''
    )
  );

  const completeness = (completeRecords.length / data.length) * 100;

  // Check each required field
  requiredFields.forEach(field => {
    const missingCount = data.filter(
      record => record[field] === null || 
                record[field] === undefined ||
                record[field] === ''
    ).length;

    if (missingCount > 0) {
      issues.push({
        severity: 'error',
        field,
        message: `${missingCount} records missing ${field}`,
        count: missingCount
      });
    }
  });

  // Uniqueness check
  const uniqueness: Record<string, number> = {};
  
  Object.keys(data[0] || {}).forEach(field => {
    const values = data.map(record => record[field]);
    const uniqueValues = new Set(values);
    uniqueness[field] = (uniqueValues.size / values.length) * 100;

    if (uniqueness[field] < 100 && field.includes('id')) {
      const duplicateCount = values.length - uniqueValues.size;
      issues.push({
        severity: 'error',
        field,
        message: `${duplicateCount} duplicate values in ${field}`,
        count: duplicateCount
      });
    }
  });

  // Type consistency check
  const consistency: Record<string, boolean> = {};

  Object.keys(data[0] || {}).forEach(field => {
    const types = new Set(
      data
        .map(record => typeof record[field])
        .filter(type => type !== 'undefined')
    );
    consistency[field] = types.size === 1;

    if (!consistency[field]) {
      issues.push({
        severity: 'warning',
        field,
        message: `Inconsistent types in ${field}: ${Array.from(types).join(', ')}`,
        count: data.length
      });
    }
  });

  // Format validity check
  const validity: Record<string, number> = {};

  // Email validation
  const emailFields = Object.keys(data[0] || {}).filter(k => 
    k.toLowerCase().includes('email')
  );

  emailFields.forEach(field => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = data.filter(record => {
      const value = record[field];
      return typeof value === 'string' && emailRegex.test(value);
    }).length;

    validity[field] = (validEmails / data.length) * 100;

    if (validity[field] < 100) {
      const invalidCount = data.length - validEmails;
      issues.push({
        severity: 'error',
        field,
        message: `${invalidCount} invalid email formats`,
        count: invalidCount
      });
    }
  });

  // Find duplicates
  const serialized = data.map(record => JSON.stringify(record));
  const uniqueRecords = new Set(serialized);
  const duplicateRecords = serialized.length - uniqueRecords.size;

  if (duplicateRecords > 0) {
    issues.push({
      severity: 'warning',
      field: '_record',
      message: `${duplicateRecords} duplicate records found`,
      count: duplicateRecords
    });
  }

  return {
    completeness,
    uniqueness,
    consistency,
    validity,
    accuracy: {}, // Accuracy requires reference data
    metrics: {
      totalRecords: data.length,
      completeRecords: completeRecords.length,
      duplicateRecords,
      invalidRecords: data.length - completeRecords.length
    },
    issues: issues.sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
  };
}
```

**Validation:**

- [ ] Quality metrics calculated
- [ ] Issues identified and prioritized
- [ ] Report comprehensive
- [ ] Actionable recommendations

**Output**: Data quality audit report

### Step 4: Data Transformation

**Objective**: Transform data between formats

**Actions:**

```typescript
interface TransformRule {
  source: string;
  target: string;
  transform?: (value: unknown) => unknown;
}

export function transformJSON(
  data: Record<string, unknown>[],
  rules: TransformRule[]
): Record<string, unknown>[] {
  return data.map(record => {
    const transformed: Record<string, unknown> = {};

    rules.forEach(rule => {
      const sourceValue = record[rule.source];
      const targetValue = rule.transform 
        ? rule.transform(sourceValue)
        : sourceValue;

      transformed[rule.target] = targetValue;
    });

    return transformed;
  });
}

// Example transformations
const transformRules: TransformRule[] = [
  {
    source: 'user_id',
    target: 'userId'
  },
  {
    source: 'created_at',
    target: 'createdAt',
    transform: (value) => new Date(value as string).toISOString()
  },
  {
    source: 'price',
    target: 'priceInCents',
    transform: (value) => Math.round((value as number) * 100)
  },
  {
    source: 'is_active',
    target: 'status',
    transform: (value) => value ? 'active' : 'inactive'
  }
];

const transformed = transformJSON(originalData, transformRules);
```

**Common Transformations:**

```typescript
// Snake case to camel case
export function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  Object.keys(obj).forEach(key => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => 
      letter.toUpperCase()
    );
    result[camelKey] = obj[key];
  });
  
  return result;
}

// Flatten nested objects
export function flatten(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flatten(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = value;
    }
  });
  
  return result;
}

// Deep merge objects
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };
  
  Object.keys(source).forEach(key => {
    if (
      typeof source[key] === 'object' &&
      source[key] !== null &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  });
  
  return result;
}
```

**Validation:**

- [ ] Transformations applied correctly
- [ ] No data loss
- [ ] Types preserved
- [ ] Edge cases handled

**Output**: Transformed data

### Step 5: Anomaly Detection

**Objective**: Find outliers and anomalies

**Actions:**

```typescript
interface Anomaly {
  record: number;
  field: string;
  value: unknown;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export function detectAnomalies(
  data: Record<string, unknown>[]
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Numeric anomalies (outliers)
  const numericFields = Object.keys(data[0] || {}).filter(key =>
    typeof data[0][key] === 'number'
  );

  numericFields.forEach(field => {
    const values = data
      .map(record => record[field])
      .filter(v => typeof v === 'number') as number[];

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    data.forEach((record, index) => {
      const value = record[field] as number;
      const zScore = Math.abs((value - mean) / stdDev);

      if (zScore > 3) {
        anomalies.push({
          record: index,
          field,
          value,
          reason: `Value ${value} is ${zScore.toFixed(2)} standard deviations from mean`,
          severity: zScore > 4 ? 'high' : 'medium'
        });
      }
    });
  });

  // String length anomalies
  const stringFields = Object.keys(data[0] || {}).filter(key =>
    typeof data[0][key] === 'string'
  );

  stringFields.forEach(field => {
    const lengths = data
      .map(record => record[field])
      .filter(v => typeof v === 'string')
      .map(v => (v as string).length);

    const avgLength = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;

    data.forEach((record, index) => {
      const value = record[field] as string;
      const length = value.length;

      if (length > avgLength * 3 || length < avgLength / 3) {
        anomalies.push({
          record: index,
          field,
          value,
          reason: `String length ${length} significantly differs from average ${avgLength.toFixed(0)}`,
          severity: 'low'
        });
      }
    });
  });

  // Null value anomalies (when field is usually not null)
  Object.keys(data[0] || {}).forEach(field => {
    const nullCount = data.filter(
      record => record[field] === null || record[field] === undefined
    ).length;

    const nullPercentage = (nullCount / data.length) * 100;

    if (nullPercentage > 0 && nullPercentage < 10) {
      data.forEach((record, index) => {
        if (record[field] === null || record[field] === undefined) {
          anomalies.push({
            record: index,
            field,
            value: null,
            reason: `Unexpected null value (only ${nullPercentage.toFixed(1)}% of records are null)`,
            severity: 'medium'
          });
        }
      });
    }
  });

  return anomalies.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}
```

**Validation:**

- [ ] Outliers detected
- [ ] Severity assessed
- [ ] False positives minimized
- [ ] Actionable insights

**Output**: Anomaly detection report

### Step 6: Generate Audit Report

**Objective**: Create comprehensive audit report

**Actions:**

```typescript
interface AuditReport {
  summary: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    qualityScore: number;
  };
  structure: DataAnalysis;
  validation: ValidationResult;
  quality: DataQualityReport;
  anomalies: Anomaly[];
  recommendations: string[];
}

export function generateAuditReport(
  data: unknown[],
  schema?: z.ZodSchema
): AuditReport {
  const analysis = analyzeJSON(data);
  
  const validation = schema
    ? validateWithZod(data, schema)
    : { valid: true, errors: [], validRecords: data.length, invalidRecords: 0 };

  const quality = auditDataQuality(
    data as Record<string, unknown>[],
    Object.keys((data[0] as Record<string, unknown>) || {})
  );

  const anomalies = detectAnomalies(data as Record<string, unknown>[]);

  const recommendations: string[] = [];

  // Generate recommendations
  if (validation.invalidRecords > 0) {
    recommendations.push(
      `Fix ${validation.invalidRecords} validation errors before processing data`
    );
  }

  if (quality.completeness < 95) {
    recommendations.push(
      `Improve data completeness from ${quality.completeness.toFixed(1)}% to 95%+`
    );
  }

  if (quality.metrics.duplicateRecords > 0) {
    recommendations.push(
      `Remove ${quality.metrics.duplicateRecords} duplicate records`
    );
  }

  if (anomalies.filter(a => a.severity === 'high').length > 0) {
    recommendations.push(
      `Investigate ${anomalies.filter(a => a.severity === 'high').length} high-severity anomalies`
    );
  }

  const qualityScore = calculateQualityScore({
    completeness: quality.completeness,
    validity: validation.validRecords / data.length * 100,
    duplicates: quality.metrics.duplicateRecords,
    anomalies: anomalies.length
  });

  return {
    summary: {
      totalRecords: data.length,
      validRecords: validation.validRecords,
      invalidRecords: validation.invalidRecords,
      qualityScore
    },
    structure: analysis,
    validation,
    quality,
    anomalies,
    recommendations
  };
}

function calculateQualityScore(metrics: {
  completeness: number;
  validity: number;
  duplicates: number;
  anomalies: number;
}): number {
  let score = 100;

  score -= (100 - metrics.completeness) * 0.4;
  score -= (100 - metrics.validity) * 0.4;
  score -= Math.min(metrics.duplicates / 10, 10);
  score -= Math.min(metrics.anomalies / 5, 10);

  return Math.max(0, Math.round(score));
}
```

**Validation:**

- [ ] Report complete
- [ ] Recommendations actionable
- [ ] Quality score accurate
- [ ] Issues prioritized

**Output**: Comprehensive audit report

## Output

**Produces:**

- Data structure analysis
- Schema validation results
- Data quality metrics
- Anomaly detection report
- Transformation results
- Comprehensive audit report
- Actionable recommendations

**Success Criteria:**

- All validations completed
- Quality issues identified
- Anomalies detected
- Transformations successful
- Report comprehensive and actionable

## Best Practices

1. **Schema First**: Define Zod schemas for all data
2. **Incremental Validation**: Validate data at boundaries
3. **Quality Metrics**: Track quality over time
4. **Anomaly Threshold**: Tune thresholds for your data
5. **Transform Safely**: Preserve original data
6. **Report Clearly**: Prioritize issues by severity
7. **Automate Checks**: Run audits in CI/CD
8. **Document Patterns**: Document discovered patterns
9. **Fix Root Cause**: Address data quality at source
10. **Monitor Trends**: Track quality metrics over time

## Related Skills

- api-app-testing - API data validation
- tdd-methodology - Test-driven validation
- error-handling-patterns - Error handling for invalid data

## Notes

- Always validate external data
- Use Zod for runtime validation
- Track data quality metrics
- Automate data audits
- Fix issues at the source
- Document data patterns
- Monitor quality trends
- Test with real data samples
