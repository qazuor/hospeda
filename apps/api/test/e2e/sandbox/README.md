# MercadoPago Sandbox E2E Tests

## Purpose

This directory contains End-to-End (E2E) tests that exercise the **real MercadoPago Sandbox API** through the QZPay billing SDK. These tests verify that our integration with MercadoPago works correctly in a controlled test environment before deploying to production.

**Important:** These are NOT unit tests or integration tests. They make real network calls to MercadoPago's sandbox environment and may take several seconds to complete.

## Test Strategy

These tests verify:

1. **Payment Preference Creation** - Creating checkout preferences for subscriptions
2. **Customer Management** - Creating and retrieving test customers
3. **Subscription Lifecycle** - Creating and managing test subscriptions
4. **Webhook Verification** - Validating webhook signature verification

Unlike unit tests that mock external dependencies, these tests:

- Make real HTTP requests to MercadoPago sandbox
- May be slow due to network latency
- May occasionally fail due to network issues (retries are implemented)
- Require valid sandbox credentials to run

## When to Run

**Local Development:**

- Run manually when making changes to billing/payment code
- Run before creating PRs that touch payment flows
- NOT run as part of `pnpm test` (separate command)

**CI/CD:**

- Run in a separate CI job (not the main test suite)
- Only run when sandbox credentials are configured
- Can be scheduled to run nightly instead of on every commit

## Setup

### 1. Get Sandbox Credentials

1. Create a MercadoPago test account at <https://www.mercadopago.com.ar/developers>
2. Navigate to "Tus aplicaciones" > "Crear aplicación"
3. Get your **TEST** credentials (starts with `TEST-`)
4. Generate a webhook secret for IPN verification

### 2. Configure Environment Variables

Create a `.env.sandbox` file in `apps/api/` (this file is gitignored):

```bash
# MercadoPago Sandbox Credentials
HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN=TEST-1234567890-abcdef-...
HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET=your-webhook-secret-here
HOSPEDA_MERCADO_PAGO_SANDBOX=true
HOSPEDA_MERCADO_PAGO_TIMEOUT=10000

# Database (use test database)
HOSPEDA_DATABASE_URL=postgresql://user:password@localhost:5432/hospeda_test

# API Configuration
API_PORT=3001
HOSPEDA_API_URL=http://localhost:3001
HOSPEDA_SITE_URL=http://localhost:4321
```

**Important:**

- Never commit real credentials to version control
- Use TEST- tokens only (production tokens will be rejected)
- Webhook secret is optional but recommended for testing signature verification

### 3. Verify Configuration

Run the configuration check:

```bash
cd apps/api
node -e "console.log(process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN ? 'Configured' : 'Not configured')"
```

## Running Tests

### Run All Sandbox Tests

```bash
cd apps/api
pnpm test:sandbox
```

### Run Specific Test File

```bash
cd apps/api
pnpm vitest test/e2e/sandbox/mercadopago-sandbox.test.ts
```

### Run with Custom Config

```bash
cd apps/api
pnpm vitest --config vitest.config.sandbox.ts
```

### Run in Watch Mode

```bash
cd apps/api
pnpm vitest test/e2e/sandbox --watch
```

## Expected Behavior

### Successful Run

When sandbox is properly configured:

```
✓ test/e2e/sandbox/mercadopago-sandbox.test.ts (4)
  ✓ MercadoPago Sandbox E2E (4)
    ✓ Payment Preference Creation
      ✓ should create a payment preference for subscription checkout (2.3s)
    ✓ Customer Management
      ✓ should create a test customer (1.8s)
    ✓ Subscription Lifecycle
      ✓ should create a subscription with sandbox plan (2.1s)
    ✓ Webhook Verification
      ✓ should verify a valid webhook signature (0.1s)

Test Files  1 passed (1)
     Tests  4 passed (4)
      Time  6.5s
```

### Skipped Tests (No Credentials)

When sandbox credentials are not configured:

```
↓ test/e2e/sandbox/mercadopago-sandbox.test.ts
  ↓ MercadoPago Sandbox E2E - SKIPPED (sandbox not configured)

Test Files  1 skipped (1)
     Tests  4 skipped (4)
      Time  0.1s
```

### Flaky Network Issues

Occasional failures due to network issues are expected. Tests automatically retry up to 2 times:

```
✓ test/e2e/sandbox/mercadopago-sandbox.test.ts (retry: 1)
  ✓ MercadoPago Sandbox E2E (4)
    ✓ should create a payment preference (retry 1) (3.2s)
    ✓ should create a test customer (1.9s)
```

## Test Architecture

### Sandbox Configuration (`sandbox-config.ts`)

Utilities for sandbox test setup:

- `isSandboxConfigured()` - Check if credentials are present
- `skipIfNoSandbox()` - Skip tests when not configured
- `withRetry()` - Retry wrapper for network calls
- `generateTestId()` - Generate unique test identifiers
- `createCleanupTracker()` - Track and cleanup test resources

### Test File Structure

```typescript
describe('MercadoPago Sandbox E2E', () => {
    // Skip entire suite if sandbox not configured
    beforeAll(() => skipIfNoSandbox());

    // Tests organized by feature area
    describe('Payment Preference Creation', () => {
        it('should create a payment preference for subscription checkout');
    });

    describe('Customer Management', () => {
        it('should create a test customer');
        it('should retrieve customer by external ID');
    });

    // Cleanup after all tests
    afterAll(async () => {
        await cleanupTestResources();
    });
});
```

## Troubleshooting

### Tests Always Skip

**Problem:** Tests skip with "sandbox not configured" message

**Solution:**

1. Verify `.env.sandbox` file exists in `apps/api/`
2. Check that `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` is set
3. Ensure token starts with `TEST-`
4. Load environment variables: `source .env.sandbox`

### Authentication Errors

**Problem:** 401 Unauthorized errors from MercadoPago API

**Solution:**

1. Verify access token is correct
2. Check token hasn't expired (regenerate if needed)
3. Ensure using TEST- token, not production token
4. Check MercadoPago application is active

### Timeout Errors

**Problem:** Tests fail with timeout errors

**Solution:**

1. Increase `HOSPEDA_MERCADO_PAGO_TIMEOUT` in environment (default: 5000ms)
2. Check internet connection
3. Verify MercadoPago sandbox is operational
4. Tests automatically retry - may just be temporary network issue

### Resource Already Exists

**Problem:** Tests fail because customer/subscription already exists

**Solution:**

1. Tests use `generateTestId()` to create unique identifiers
2. If issue persists, cleanup test resources manually
3. Check `cleanupTracker` is properly implemented

### Webhook Signature Verification Fails

**Problem:** Webhook signature tests fail

**Solution:**

1. Verify `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` is configured
2. Ensure webhook secret matches MercadoPago application
3. Check signature is correctly formatted in test

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Sandbox E2E Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Run nightly at 2 AM UTC
  workflow_dispatch:     # Allow manual trigger

jobs:
  sandbox-tests:
    runs-on: ubuntu-latest
    if: ${{ secrets.HOSPEDA_MERCADO_PAGO_TEST_TOKEN != '' }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install

      - name: Run sandbox tests
        run: pnpm test:sandbox
        env:
          HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: ${{ secrets.HOSPEDA_MERCADO_PAGO_TEST_TOKEN }}
          HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET: ${{ secrets.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET }}
          HOSPEDA_MERCADO_PAGO_SANDBOX: true
          HOSPEDA_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

### Key Points

- Only run when secrets are configured (`if` condition)
- Run on schedule (nightly) or manual trigger
- Keep separate from main test suite
- Use GitHub secrets for credentials

## Best Practices

### DO

- ✅ Use `withRetry()` for all network calls
- ✅ Generate unique test IDs to avoid collisions
- ✅ Clean up test resources after tests
- ✅ Check if sandbox is configured before running
- ✅ Use realistic test data
- ✅ Test both success and error scenarios

### DON'T

- ❌ Commit real credentials to version control
- ❌ Use production tokens in tests
- ❌ Run sandbox tests in main test suite
- ❌ Hard-code customer/subscription IDs
- ❌ Leave test resources in sandbox
- ❌ Skip cleanup logic

## Maintenance

### Regular Tasks

- **Weekly:** Run sandbox tests manually to verify functionality
- **Monthly:** Rotate sandbox credentials
- **When updating billing code:** Run full sandbox suite
- **Before releases:** Verify all sandbox tests pass

### Monitoring

- Track test execution time (should be <30s total)
- Monitor failure rate (should be <5%)
- Alert if tests consistently fail (may indicate API changes)

## Resources

- [MercadoPago Developer Portal](https://www.mercadopago.com.ar/developers)
- [MercadoPago API Reference](https://www.mercadopago.com.ar/developers/en/reference)
- [QZPay Documentation](https://github.com/qazuor/qzpay)
- [Project Billing Documentation](../../../docs/billing/)

## Support

For questions or issues with sandbox tests:

1. Check this README
2. Review test output and logs
3. Verify sandbox credentials
4. Check MercadoPago status page
5. Contact team lead or create an issue
