# OpenAPI Documentation

Interactive API documentation using OpenAPI 3.1 specification.

---

## Access Points

### Swagger UI

Interactive API explorer:

- **Production**: <https://api.hospeda.com/ui>
- **Staging**: <https://api-staging.hospeda.com/ui>
- **Local**: <http://localhost:3001/ui>

**Features:**

- Try endpoints directly from browser
- See request/response examples
- View schema definitions
- Test authentication

### Scalar API Reference

Modern API reference documentation:

- **Production**: <https://api.hospeda.com/reference>
- **Staging**: <https://api-staging.hospeda.com/reference>
- **Local**: <http://localhost:3001/reference>

**Features:**

- Beautiful, modern UI
- Code examples in multiple languages
- Dark mode support
- Search functionality

### OpenAPI JSON

Raw OpenAPI specification:

- **Production**: <https://api.hospeda.com/docs>
- **Staging**: <https://api-staging.hospeda.com/docs>
- **Local**: <http://localhost:3001/docs>

**Use for:**

- Code generation (SDK, client libraries)
- Testing tools (Postman, Insomnia)
- API validation

---

## Using Swagger UI

1. Visit <http://localhost:3001/ui>
2. Authorize with your Clerk token (click "Authorize" button)
3. Try any endpoint:
   - Select endpoint
   - Click "Try it out"
   - Enter parameters
   - Click "Execute"

---

## Generating Client SDKs

Use OpenAPI spec to generate client libraries:

```bash
# Generate TypeScript client
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:3001/docs \
  -g typescript-fetch \
  -o ./api-client

# Generate Python client
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:3001/docs \
  -g python \
  -o ./api-client
```

---

⬅️ Back to [API Usage Guide](README.md)
