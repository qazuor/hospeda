# Review Security Command

## Purpose

Comprehensive security audit analyzing authentication, authorization, input validation, and data protection. REPORTS all security findings without stopping execution.

## Usage

```bash
/review-security
```text

## Description

Performs thorough security analysis using the `security-engineer` agent. Uses **REPORT all findings** strategy to provide complete security assessment including vulnerabilities, security best practices compliance, and improvement recommendations.

---

## Execution Flow

### Step 1: Security Audit Analysis

**Agent**: `security-engineer`

**Process**:

- Comprehensive security assessment across all packages
- Vulnerability identification and risk assessment
- Security best practices validation
- Compliance check with security standards
- Threat model analysis

---

## Security Assessment Areas

### Authentication Security

**Review Scope**:

- Clerk integration implementation
- Session management
- Token handling and storage
- Password policies (if applicable)
- Multi-factor authentication setup

**Security Checks**:

- ✅ **Secure Token Storage**: Tokens stored securely (httpOnly cookies)
- ✅ **Session Expiration**: Proper session timeout configuration
- ✅ **Token Validation**: JWT verification and signature checking
- ✅ **Auth Flow Security**: Secure authentication redirects
- ✅ **Logout Security**: Complete session invalidation

**Common Vulnerabilities**:

- Session fixation attacks
- Token exposure in logs/URLs
- Insecure session storage
- Missing session invalidation
- Weak token generation

### Authorization Security

**Review Scope**:

- Role-based access control (RBAC)
- Resource-level permissions
- Actor system implementation
- API endpoint protection
- Admin panel security

**Security Checks**:

- ✅ **Permission Validation**: Proper role/permission checking
- ✅ **Resource Access Control**: User can only access own resources
- ✅ **Admin Protection**: Admin endpoints properly secured
- ✅ **Actor Context**: Proper actor propagation through layers
- ✅ **Privilege Escalation Prevention**: No unauthorized role changes

**Common Vulnerabilities**:

- Missing authorization checks
- Privilege escalation paths
- Horizontal access control issues
- Vertical access control issues
- Insecure direct object references

### Input Validation Security

**Review Scope**:

- Zod schema validation
- SQL injection prevention
- XSS prevention
- CSRF protection
- File upload security

**Security Checks**:

- ✅ **Schema Validation**: All inputs validated with Zod
- ✅ **SQL Injection Protection**: Parameterized queries only
- ✅ **XSS Prevention**: Proper output encoding
- ✅ **CSRF Protection**: Anti-CSRF tokens implemented
- ✅ **File Upload Security**: File type and size validation

**Common Vulnerabilities**:

- SQL injection vulnerabilities
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Command injection
- Path traversal attacks

### Data Protection Security

**Review Scope**:

- Sensitive data handling
- Database security
- Encryption implementation
- Data transmission security
- Privacy compliance

**Security Checks**:

- ✅ **Data Encryption**: Sensitive data encrypted at rest
- ✅ **Transmission Security**: HTTPS enforced everywhere
- ✅ **Database Security**: Proper connection string protection
- ✅ **PII Handling**: Personal data properly protected
- ✅ **Data Retention**: Appropriate data retention policies

**Common Vulnerabilities**:

- Unencrypted sensitive data
- Insecure data transmission
- Database credential exposure
- PII data leakage
- Inadequate data retention

### API Security

**Review Scope**:

- Rate limiting implementation
- CORS configuration
- API authentication
- Error message security
- Logging security

**Security Checks**:

- ✅ **Rate Limiting**: Protection against abuse
- ✅ **CORS Policy**: Proper origin restrictions
- ✅ **Error Handling**: No sensitive data in errors
- ✅ **Logging Security**: No sensitive data logged
- ✅ **API Versioning**: Secure API evolution

**Common Vulnerabilities**:

- API abuse and DoS attacks
- CORS misconfiguration
- Information disclosure in errors
- Sensitive data in logs
- Broken API authentication

### Infrastructure Security

**Review Scope**:

- Environment variable security
- Dependency vulnerabilities
- Container security
- Deployment security
- Monitoring and alerting

**Security Checks**:

- ✅ **Environment Security**: No secrets in version control
- ✅ **Dependency Audit**: No known vulnerable dependencies
- ✅ **Container Security**: Secure container configuration
- ✅ **Deployment Security**: Secure deployment practices
- ✅ **Security Monitoring**: Proper security logging

**Common Vulnerabilities**:

- Exposed environment variables
- Vulnerable dependencies
- Insecure container configurations
- Insecure deployment practices
- Insufficient security monitoring

---

## Output Format

### Success Case

```text
✅ SECURITY REVIEW COMPLETE - SECURE

Authentication Security:
✅ Clerk integration properly configured
✅ Session management secure
✅ Token handling follows best practices
✅ Logout functionality complete

Authorization Security:
✅ Role-based access control implemented
✅ Resource-level permissions enforced
✅ Actor system properly secured
✅ No privilege escalation paths found

Input Validation Security:
✅ Zod schemas validate all inputs
✅ SQL injection prevention active
✅ XSS protection implemented
✅ CSRF protection configured

Data Protection Security:
✅ Sensitive data properly encrypted
✅ HTTPS enforced throughout
✅ Database connections secured
✅ PII handling compliant

API Security:
✅ Rate limiting configured
✅ CORS policy properly set
✅ Error messages sanitized
✅ Logging security maintained

Infrastructure Security:
✅ Environment variables secured
✅ Dependencies vulnerability-free
✅ Container security configured

🔒 Application meets security standards
```text

### Vulnerabilities Found Case

```text
🚨 SECURITY REVIEW - VULNERABILITIES FOUND

Authentication Security:
❌ CRITICAL: Session tokens stored in localStorage
   File: apps/web/src/utils/auth.ts:23
   Risk: XSS attacks can steal authentication tokens
   Fix: Move to httpOnly cookies with secure flag

Authorization Security:
❌ HIGH: Missing authorization check in accommodation deletion
   File: apps/api/src/routes/accommodations/delete.ts:15
   Risk: Users can delete accommodations they don't own
   Fix: Add ownership validation before deletion

⚠️ MEDIUM: Admin role check inconsistent
   File: apps/api/src/routes/admin/users.ts:34
   Risk: Potential admin access control bypass
   Fix: Use consistent actor.role validation

Input Validation Security:
❌ HIGH: SQL injection vulnerability in search
   File: packages/db/src/models/accommodation.model.ts:67
   Risk: Raw SQL with user input allows SQL injection
   Fix: Use parameterized queries with Drizzle ORM

⚠️ MEDIUM: Missing XSS protection in comments
   File: apps/web/src/components/reviews/ReviewDisplay.tsx:45
   Risk: Stored XSS through user comments
   Fix: Add proper HTML sanitization

Data Protection Security:
⚠️ MEDIUM: Database credentials in environment file
   File: .env.example
   Risk: Example shows real database format
   Fix: Use placeholder values in example file

ℹ️ LOW: Sensitive data in debug logs
   File: packages/logger/src/logger.ts:78
   Risk: User data logged in debug mode
   Fix: Add data sanitization before logging

API Security:
❌ HIGH: Rate limiting not configured for auth endpoints
   File: apps/api/src/routes/auth/login.ts
   Risk: Brute force attacks on authentication
   Fix: Add stricter rate limits for auth endpoints

Infrastructure Security:
⚠️ MEDIUM: Dependency vulnerability detected
   Package: some-vulnerable-package@1.2.3
   Risk: Known security vulnerability CVE-2024-XXXX
   Fix: Update to version 1.2.4 or higher

Security Summary:

- Critical Vulnerabilities: 2 (fix immediately)
- High Risk Issues: 3 (fix before production)
- Medium Risk Issues: 4 (address soon)
- Low Risk Issues: 1 (nice to fix)

🔧 Address critical and high-risk issues before deployment
```text

---

## Risk Assessment Levels

### Critical Vulnerabilities

**Immediate Action Required**:

- Authentication bypass vulnerabilities
- SQL injection with data access
- Remote code execution possibilities
- Authentication token exposure
- Admin privilege escalation

**Impact**: Complete system compromise possible

### High Risk Issues

**Fix Before Production**:

- Authorization bypass vulnerabilities
- Sensitive data exposure
- Cross-site scripting (XSS)
- Missing input validation
- Rate limiting missing on critical endpoints

**Impact**: Significant security breach possible

### Medium Risk Issues

**Address Soon**:

- Information disclosure
- Missing security headers
- Weak session management
- Insufficient logging
- Dependency vulnerabilities

**Impact**: Limited security impact or difficult to exploit

### Low Risk Issues

**Nice to Fix**:

- Security hardening opportunities
- Best practice improvements
- Non-critical information disclosure
- Logging improvements

**Impact**: Minimal security impact

---

## Security Validation by Layer

### API Layer Security

**Validation Points**:

- Authentication middleware on protected routes
- Authorization checks in route handlers
- Input validation with Zod schemas
- Rate limiting configuration
- Error handling without data leakage

### Service Layer Security

**Validation Points**:

- Business logic authorization
- Data validation and sanitization
- Secure data processing
- Audit logging for sensitive operations

### Database Layer Security

**Validation Points**:

- Parameterized queries only
- Proper connection string handling
- Data encryption for sensitive fields
- Access control at database level

### Frontend Security

**Validation Points**:

- Secure token storage
- XSS prevention in user content
- CSRF protection in forms
- Secure communication with APIs

---

## Security Testing Integration

### Automated Security Testing

**Static Analysis**:

- ESLint security rules
- Dependency vulnerability scanning
- Code security pattern analysis

**Dynamic Testing**:

- API security testing
- Authentication flow testing
- Authorization boundary testing

### Manual Security Testing

**Penetration Testing Areas**:

- Authentication bypass attempts
- Authorization escalation testing
- Input validation testing
- Session management testing

---

## Compliance Considerations

### GDPR Compliance

- Personal data handling review
- Data retention policy validation
- User consent mechanisms
- Data deletion capabilities

### OWASP Top 10

- A01: Broken Access Control
- A02: Cryptographic Failures
- A03: Injection
- A04: Insecure Design
- A05: Security Misconfiguration
- A06: Vulnerable and Outdated Components
- A07: Identification and Authentication Failures
- A08: Software and Data Integrity Failures
- A09: Security Logging and Monitoring Failures
- A10: Server-Side Request Forgery

---

## Related Commands

- `/pen-test` - Active penetration testing
- `/quality-check` - Includes security review
- `/review-code` - Code quality with security considerations

---

## When to Use

- **Part of**: `/quality-check` comprehensive validation
- **Before Production**: Pre-deployment security validation
- **Regular Audits**: Periodic security assessment
- **After Dependencies Update**: Security impact of changes

---

## Prerequisites

- Application functionality complete
- Authentication system implemented
- All security features configured

---

## Post-Command Actions

**If No Issues**: Deploy with confidence

**If Vulnerabilities Found**:

1. **Critical**: Fix immediately before any deployment
2. **High Risk**: Fix before production deployment
3. **Medium Risk**: Plan fixes in security sprint
4. **Low Risk**: Address during regular maintenance

**Documentation**: Update security guidelines and learnings

