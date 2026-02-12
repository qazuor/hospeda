---
name: json-data-auditor
description: JSON data validation, audit, and quality scoring. Use when reviewing API responses, configuration files, data exports, or schema compliance.
---

# JSON Data Auditor

## Purpose

Validate, audit, and score JSON data for quality, consistency, and schema compliance. Use this skill when reviewing API responses, configuration files, data exports, fixtures, or any structured JSON data.

## Activation

Use this skill when the user asks to:

- Validate JSON data against a schema
- Audit data quality or consistency
- Score JSON data for completeness
- Find anomalies in JSON datasets
- Check JSON configuration files

## Schema Validation

### JSON Schema Validation Checklist

When validating JSON against a schema (JSON Schema draft-07 or later):

1. **Type correctness** - Every field matches its declared type (`string`, `number`, `boolean`, `array`, `object`, `null`)
2. **Required fields** - All `required` properties are present
3. **Enum constraints** - Values match allowed enum sets
4. **Format validation** - Strings match declared formats (`date-time`, `email`, `uri`, `uuid`, `ipv4`, `ipv6`)
5. **Range constraints** - Numbers satisfy `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`
6. **String constraints** - Strings satisfy `minLength`, `maxLength`, `pattern`
7. **Array constraints** - Arrays satisfy `minItems`, `maxItems`, `uniqueItems`
8. **Nested validation** - Recursively validate nested objects and arrays
9. **Additional properties** - Flag unexpected properties when `additionalProperties: false`
10. **Conditional schemas** - Evaluate `if/then/else`, `oneOf`, `anyOf`, `allOf`, `not`

### Schema Inference

When no schema is provided, infer one:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "name": { "type": "string", "minLength": 1 },
    "email": { "type": "string", "format": "email" },
    "createdAt": { "type": "string", "format": "date-time" },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "uniqueItems": true
    }
  },
  "required": ["id", "name", "email"]
}
```

## Consistency Checks

### Cross-Record Consistency

For arrays of objects (datasets), check:

1. **Field presence consistency** - Same fields across all records (flag optional vs missing)
2. **Type consistency** - Same field has same type across records (flag type coercion issues)
3. **Referential integrity** - Foreign key references point to valid records
4. **Uniqueness** - Fields expected to be unique (IDs, emails) are actually unique
5. **Enum consistency** - Categorical fields use consistent values (no "active" vs "Active" vs "ACTIVE")

### Value Pattern Consistency

1. **Date formats** - All dates use the same format (ISO 8601 preferred)
2. **Naming conventions** - Keys follow consistent casing (`camelCase`, `snake_case`, `kebab-case`)
3. **Null handling** - Consistent use of `null` vs missing key vs empty string
4. **Number precision** - Consistent decimal places for monetary/measurement values
5. **String encoding** - UTF-8 throughout, no mixed encoding

## Data Quality Scoring

### Quality Dimensions (0-100 each)

| Dimension | What It Measures |
|---|---|
| **Completeness** | Percentage of non-null, non-empty required fields |
| **Validity** | Percentage of values passing format/type validation |
| **Consistency** | Cross-record uniformity of types, formats, casing |
| **Uniqueness** | No unintended duplicate records or values |
| **Accuracy** | Values within plausible ranges (dates not in future, ages 0-150) |
| **Timeliness** | Timestamps are recent and not stale |

### Scoring Formula

```
Overall Score = (Completeness * 0.25) + (Validity * 0.25) + (Consistency * 0.20)
              + (Uniqueness * 0.15) + (Accuracy * 0.10) + (Timeliness * 0.05)
```

### Output Format

```markdown
## JSON Data Audit Report

**File/Source:** `data.json`
**Records:** 1,247
**Fields per record:** 12

### Quality Score: 87/100

| Dimension     | Score | Issues |
|---------------|-------|--------|
| Completeness  | 92    | 3 records missing `email` |
| Validity      | 85    | 47 invalid date formats |
| Consistency   | 88    | Mixed casing in `status` field |
| Uniqueness    | 95    | 2 duplicate `userId` values |
| Accuracy      | 78    | 15 records with future `createdAt` |
| Timeliness    | 90    | 12 records older than 1 year |

### Critical Issues
1. **[CRITICAL]** Duplicate primary keys: records 45, 892
2. **[HIGH]** Invalid email format in 23 records
3. **[MEDIUM]** Inconsistent null handling: `address` uses both `null` and `""`

### Recommendations
1. Add unique constraint on `userId`
2. Normalize date format to ISO 8601
3. Standardize null representation
```

## Common JSON Anti-Patterns

Flag these when found:

| Anti-Pattern | Example | Fix |
|---|---|---|
| Stringified numbers | `"age": "25"` | `"age": 25` |
| Stringified booleans | `"active": "true"` | `"active": true` |
| Nested stringified JSON | `"meta": "{\"key\":\"val\"}"` | `"meta": {"key": "val"}` |
| Inconsistent arrays | `"tags": "a,b,c"` | `"tags": ["a","b","c"]` |
| Date as epoch only | `"created": 1700000000` | `"created": "2023-11-14T22:13:20Z"` |
| Deeply nested structures | 6+ levels of nesting | Flatten or normalize |
| Massive single objects | 1000+ top-level keys | Split into sub-objects |
| Mixed null semantics | `null`, `""`, `"N/A"`, `"none"` | Use `null` consistently |

## Tooling Integration

When suggesting fixes, provide actionable code:

```typescript
// Validate with Zod
import { z } from "zod";

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
  createdAt: z.string().datetime(),
  tags: z.array(z.string()).default([]),
});

type User = z.infer<typeof UserSchema>;

// Validate array of records
const UsersSchema = z.array(UserSchema);
const result = UsersSchema.safeParse(data);
if (!result.success) {
  console.error(result.error.format());
}
```

```typescript
// Validate with ajv (JSON Schema)
import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const validate = ajv.compile(schema);
const valid = validate(data);
if (!valid) {
  console.error(validate.errors);
}
```
