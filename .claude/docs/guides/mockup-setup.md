# Mockup Generation Setup Guide

> **Complete guide to setting up AI-powered mockup generation for the Hospeda project**

## Overview

This guide walks you through setting up the AI mockup generation system, from creating a Replicate account to configuring your local environment. Follow these steps to start generating UI mockups for your planning sessions.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Replicate Account Setup](#replicate-account-setup)
3. [API Token Generation](#api-token-generation)
4. [Environment Configuration](#environment-configuration)
5. [Verification](#verification)
6. [Optional Configuration](#optional-configuration)
7. [Troubleshooting](#troubleshooting)
8. [Cost Management](#cost-management)

---

## Prerequisites

Before you begin, ensure you have:

- [ ] Node.js 18+ installed
- [ ] PNPM package manager installed
- [ ] Hospeda project cloned and dependencies installed
- [ ] Credit/debit card for Replicate billing (free tier available)
- [ ] Internet connection for API calls

**Check your Node.js version:**

```bash
node --version
# Should output v18.x.x or higher
```

**Check PNPM:**

```bash
pnpm --version
# Should output 8.x.x or higher
```

---

## Replicate Account Setup

### Step 1: Create Account

1. Visit [replicate.com](https://replicate.com)
2. Click **"Sign Up"** in the top right
3. Choose sign-up method:
   - **GitHub** (recommended - fastest)
   - **Google**
   - **Email + Password**

**Screenshot Reference:**

```
┌─────────────────────────────────────┐
│  Welcome to Replicate              │
│                                     │
│  Sign up with:                     │
│  ┌─────────────────────┐           │
│  │  Continue with GitHub │          │
│  └─────────────────────┘           │
│  ┌─────────────────────┐           │
│  │  Continue with Google │          │
│  └─────────────────────┘           │
│  ┌─────────────────────┐           │
│  │  Sign up with Email   │          │
│  └─────────────────────┘           │
└─────────────────────────────────────┘
```

### Step 2: Verify Email

If you signed up with email:

1. Check your inbox for verification email from Replicate
2. Click the verification link
3. You'll be redirected to your Replicate dashboard

---

## API Token Generation

### Step 1: Navigate to API Tokens

1. Log in to your Replicate account
2. Click your **profile avatar** in the top right
3. Select **"API Tokens"** from the dropdown menu

**Or direct link:** [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)

### Step 2: Generate New Token

1. Click **"Create Token"** button
2. Give your token a descriptive name:

   ```
   Name: Hospeda Mockup Generation
   ```

3. Click **"Create"**

**Important:** The token will only be shown ONCE. Copy it immediately!

### Step 3: Copy Your Token

Your token will look like:

```
r8_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
```

**Token Format:**

- Starts with `r8_`
- Followed by 40 alphanumeric characters
- Total length: 43 characters

⚠️ **Security Warning:**

- Never commit your token to git
- Never share your token publicly
- Don't include it in screenshots or documentation
- Treat it like a password

---

## Environment Configuration

### Step 1: Locate .env.local File

The Hospeda project uses `.env.local` for local environment variables:

```bash
cd /path/to/hospeda
ls -la | grep .env
```

You should see:

```
.env.local        # Your local config (git-ignored)
.env.example      # Example template
```

**If .env.local doesn't exist:**

```bash
# Copy from example
cp .env.example .env.local
```

### Step 2: Add Replicate Token

Open `.env.local` in your editor:

```bash
# Using VS Code
code .env.local

# Or any editor
nano .env.local
vim .env.local
```

Add your Replicate API token:

```bash
# AI Image Generation (Replicate)
REPLICATE_API_TOKEN=r8_YOUR_ACTUAL_TOKEN_HERE

# Optional: Specify model (defaults to flux-schnell)
# REPLICATE_MODEL=black-forest-labs/flux-schnell
```

**Example .env.local:**

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hospeda

# Authentication
CLERK_SECRET_KEY=sk_test_...

# AI Image Generation (Replicate)
REPLICATE_API_TOKEN=r8_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
```

### Step 3: Verify .gitignore

Ensure `.env.local` is in `.gitignore` (it should already be there):

```bash
# Check if .env.local is ignored
git check-ignore .env.local
# Should output: .env.local

# If not, add to .gitignore
echo ".env.local" >> .gitignore
```

---

## Verification

### Step 1: Run End-to-End Test

The project includes a comprehensive E2E test to verify your setup:

```bash
# From project root
pnpm tsx packages/ai-image-generation/examples/e2e-test.ts
```

**Expected Output:**

```
╔════════════════════════════════════════════════════════════════════╗
║           MOCKUP GENERATION SYSTEM - E2E TEST                      ║
║                                                                    ║
║  This test validates the complete mockup generation workflow      ║
╚════════════════════════════════════════════════════════════════════╝

🔍 STEP 1: Validating Environment
═══════════════════════════════════════════════════════════════════

✓ REPLICATE_API_TOKEN found: r8_AbCdEf...

🎨 STEP 2: Generating Mockup
═══════════════════════════════════════════════════════════════════

ℹ Prompt: "Modern hotel landing page with hero section, booking form, and room gallery"
ℹ Filename: "hotel-landing-page.png"
ℹ Calling Replicate API...

✓ Mockup generated successfully!
ℹ Image path: .claude/sessions/planning/P-005-test/mockups/hotel-landing-page-20251104-143022.png
ℹ Generation time: 2748ms
ℹ Model: black-forest-labs/flux-schnell
ℹ Cost: $0.0030

📁 STEP 3: Verifying File Outputs
═══════════════════════════════════════════════════════════════════

✓ Image file exists: ...
ℹ Image size: 412.34 KB

✓ Metadata registry exists: ...
ℹ Total mockups: 1

💰 STEP 4: Verifying Cost Tracking
═══════════════════════════════════════════════════════════════════

✓ Usage tracking file exists
ℹ Current month: 2025-11
ℹ Mockup count: 1
ℹ Total cost: $0.0030
✓ 49 mockups remaining (1/50 used)

📊 FINAL RESULTS
═══════════════════════════════════════════════════════════════════

✓ Environment Configuration
✓ Mockup Generation
✓ File Outputs
✓ Cost Tracking

✓ ALL CHECKS PASSED
The mockup generation system is working correctly!
```

### Step 2: Check Generated Files

Verify the mockup was created:

```bash
# List generated mockups
ls .claude/sessions/planning/P-005-test/mockups/

# Expected output:
# hotel-landing-page-20251104-143022.png
# .registry.json
# README.md
```

### Step 3: View Mockup

Open the generated image to verify quality:

```bash
# macOS
open .claude/sessions/planning/P-005-test/mockups/hotel-landing-page-*.png

# Linux
xdg-open .claude/sessions/planning/P-005-test/mockups/hotel-landing-page-*.png

# Windows (Git Bash)
start .claude/sessions/planning/P-005-test/mockups/hotel-landing-page-*.png
```

✅ **Setup complete if:**

- E2E test passes all 4 checks
- Mockup image file exists
- Image opens and looks reasonable
- Cost tracking file updated

---

## Optional Configuration

### 1. Model Selection

Change the AI model used for generation:

```bash
# .env.local

# Recommended: Fast and cheap (default)
REPLICATE_MODEL=black-forest-labs/flux-schnell

# Alternative: Better quality, slower, more expensive
REPLICATE_MODEL=black-forest-labs/flux-dev

# Pro: Best quality, most expensive
REPLICATE_MODEL=black-forest-labs/flux-pro
```

**Model Comparison:**

| Model | Speed | Quality | Cost/Image | Use Case |
|-------|-------|---------|-----------|----------|
| **flux-schnell** | ⚡⚡⚡ Very Fast | ✨✨ Good | $0.003 | Wireframes, planning mockups |
| **flux-dev** | ⚡⚡ Medium | ✨✨✨ Excellent | $0.055 | High-fidelity designs |
| **flux-pro** | ⚡⚡ Medium | ✨✨✨ Excellent | $0.055 | Client presentations |

**Recommendation:** Use `flux-schnell` (default) for planning mockups.

### 2. Output Path Customization

Customize where mockups are saved:

```ts
// packages/ai-image-generation/src/config.ts
export const loadEnvConfig = (): MockupConfig => ({
  // ...
  outputPath: process.env.MOCKUP_OUTPUT_PATH || '.claude/sessions/planning',
});
```

Then in `.env.local`:

```bash
MOCKUP_OUTPUT_PATH=/custom/path/to/mockups
```

### 3. Retry Configuration

Adjust API retry behavior:

```ts
const generator = new MockupGenerator({
  replicateApiToken: config.replicateApiToken,
  maxRetries: 5, // Default: 3, Max: 10
  retryDelay: 2000, // Default: 1000ms
});
```

### 4. Cost Limits

The system has built-in cost protection:

```ts
// Default limits (packages/ai-image-generation/src/utils/cost-tracker.ts)
const MONTHLY_LIMIT = 50; // mockups per month
const THRESHOLD_ALERT = 0.8; // 80% usage alert
```

To customize limits, modify in code or wrap with your own logic:

```ts
const result = await generator.generate({ /* ... */ });

// Custom limit check
const usage = await costTracker.load(sessionPath);
if (usage.mockupCount >= 30) { // Custom limit: 30
  console.warn('Custom monthly limit reached!');
  return;
}
```

---

## Troubleshooting

### Issue 1: Token Not Found

**Error:**

```
✗ REPLICATE_API_TOKEN not found in environment
```

**Solutions:**

1. **Verify .env.local exists:**

   ```bash
   ls -la .env.local
   ```

2. **Check token is in .env.local:**

   ```bash
   grep REPLICATE_API_TOKEN .env.local
   ```

3. **Verify token format:**
   - Should start with `r8_`
   - Should be 43 characters total
   - No spaces or quotes around the value

4. **Restart your terminal/IDE:**
   Environment variables may not reload until restart.

---

### Issue 2: Invalid Token

**Error:**

```
status 401: "Invalid API token"
```

**Solutions:**

1. **Regenerate token:**
   - Go to [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
   - Delete old token
   - Create new token
   - Update .env.local

2. **Check for extra characters:**

   ```bash
   # Should be exactly 43 characters
   echo -n "$REPLICATE_API_TOKEN" | wc -c
   ```

3. **Verify no quotes in .env.local:**

   ```bash
   # ✅ Correct
   REPLICATE_API_TOKEN=r8_AbCdEf...

   # ❌ Incorrect
   REPLICATE_API_TOKEN="r8_AbCdEf..."
   REPLICATE_API_TOKEN='r8_AbCdEf...'
   ```

---

### Issue 3: Insufficient Credit

**Error:**

```
status 402: "You have insufficient credit to run this model."
```

**Solutions:**

1. **Add billing information:**
   - Go to [replicate.com/billing](https://replicate.com/billing)
   - Click **"Add payment method"**
   - Enter credit/debit card details
   - Add initial credit ($5 minimum recommended)

2. **Check current balance:**
   - Visit [replicate.com/billing](https://replicate.com/billing)
   - View "Current Balance" and "Usage This Month"

3. **Enable auto-recharge (recommended):**
   - In billing settings
   - Set threshold (e.g., $1)
   - Set recharge amount (e.g., $10)
   - Never run out of credit during generation

---

### Issue 4: Network Errors

**Error:**

```
ECONNREFUSED, ETIMEDOUT, DNS_ERROR
```

**Solutions:**

1. **Check internet connection:**

   ```bash
   ping replicate.com
   ```

2. **Verify proxy settings (if applicable):**

   ```bash
   # Check proxy environment variables
   echo $HTTP_PROXY
   echo $HTTPS_PROXY

   # If behind corporate proxy, add to .env.local
   HTTP_PROXY=http://proxy.company.com:8080
   HTTPS_PROXY=http://proxy.company.com:8080
   ```

3. **Check firewall:**
   - Ensure outbound HTTPS (443) is allowed
   - Whitelist `*.replicate.com` if needed

---

### Issue 5: Slow Generation

**Problem:** Mockup takes too long to generate (>15 seconds)

**Solutions:**

1. **Check model:**

   ```bash
   # flux-schnell is fastest (~2-4s)
   # flux-dev and flux-pro are slower (~8-15s)
   grep REPLICATE_MODEL .env.local
   ```

2. **Verify Replicate service status:**
   - Visit [status.replicate.com](https://status.replicate.com)
   - Check for ongoing incidents

3. **Simplify prompt:**
   - Shorter prompts may generate faster
   - Remove unnecessary details

---

### Issue 6: Poor Mockup Quality

**Problem:** Generated mockup doesn't match expectations

**Solutions:**

1. **Improve your prompt:**
   - Read [Prompt Engineering Guide](./mockup-prompt-engineering.md)
   - Be more specific about layout and elements
   - Add visual style descriptors

2. **Try different model:**

   ```bash
   # Better quality but more expensive
   REPLICATE_MODEL=black-forest-labs/flux-dev
   ```

3. **Regenerate with refined prompt:**
   - Analyze what's wrong with current mockup
   - Adjust prompt to address specific issues
   - Generate again

---

## Cost Management

### Understanding Costs

**Per-Image Costs:**

- **flux-schnell:** $0.003 per image
- **flux-dev:** $0.055 per image
- **flux-pro:** $0.055 per image

**Monthly Budget Examples:**

- $10/month → ~3,333 mockups (flux-schnell)
- $10/month → ~181 mockups (flux-dev)
- $25/month → ~8,333 mockups (flux-schnell)

### Built-In Protection

The system includes automatic cost protection:

**1. Monthly Limit (50 mockups/month default):**

```
✓ 42 mockups remaining (8/50 used)
```

**2. Threshold Alert (80% usage):**

```
⚠ Only 10 mockups remaining before threshold!
```

**3. Hard Limit Enforcement:**

```
✗ Monthly mockup limit (50) reached!
```

### Tracking Usage

**Check current usage:**

```bash
# View usage file
cat .claude/sessions/planning/P-005/.usage-tracking.json

# Example output:
{
  "currentMonth": "2025-11",
  "mockupCount": 8,
  "totalCost": 0.024,
  "lastReset": "2025-11-01T00:00:00.000Z"
}
```

**Monthly reset:**

- Usage resets automatically on the 1st of each month
- Old usage is archived for reference
- Limits restart at 0/50

### Best Practices

1. **Use flux-schnell for planning:**
   - 18x cheaper than flux-dev/pro
   - Sufficient quality for wireframes
   - Reserve expensive models for final designs

2. **Generate selectively:**
   - Don't mockup every screen
   - Focus on complex/novel UI flows
   - Use text wireframes for simple layouts

3. **Set billing alerts:**
   - In Replicate dashboard: Settings → Billing
   - Set alert at your monthly budget
   - Get email when approaching limit

4. **Review usage regularly:**

   ```bash
   # Quick usage check
   pnpm tsx packages/ai-image-generation/examples/cost-tracker-usage.ts
   ```

---

## Next Steps

Now that your environment is set up:

1. **Read the Prompt Engineering Guide:**
   - [Mockup Prompt Engineering Guide](./mockup-prompt-engineering.md)
   - Learn to craft effective prompts
   - Study good/bad examples

2. **Try generating mockups:**

   ```bash
   # Interactive example
   pnpm tsx packages/ai-image-generation/examples/basic-usage.ts
   ```

3. **Integrate in planning:**
   - Use MockupGenerator in PDR creation
   - See [UX/UI Designer Agent](../../agents/design/ux-ui-designer.md)

4. **Explore advanced features:**
   - Custom presets
   - Batch generation
   - Metadata querying

---

## Additional Resources

**Documentation:**

- [AI Image Generation Package README](../../../packages/ai-image-generation/README.md)
- [UX/UI Designer Agent](../../agents/design/ux-ui-designer.md)
- [Prompt Engineering Guide](./mockup-prompt-engineering.md)

**Replicate Resources:**

- [Replicate Documentation](https://replicate.com/docs)
- [FLUX Models](https://replicate.com/collections/flux)
- [API Reference](https://replicate.com/docs/reference/http)

**Example Code:**

- `packages/ai-image-generation/examples/` - Working examples
- `packages/ai-image-generation/test/` - Test cases showing usage patterns

---

## Support

**Issues with setup?**

1. Check [Troubleshooting](#troubleshooting) section above
2. Review [E2E test output](#step-1-run-end-to-end-test) for specific errors
3. Consult [Replicate documentation](https://replicate.com/docs)
4. Check Hospeda project issues on GitHub

**Security concerns?**

- Never commit `.env.local` to git
- Rotate tokens if accidentally exposed
- Report security issues privately

---

**Last Updated:** 2025-11-04
**Version:** 1.0.0
**Related:** P-005, PF-005-19
