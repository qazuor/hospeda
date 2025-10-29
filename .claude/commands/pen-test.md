# Pen Test Command

## Purpose

Active penetration testing simulation to identify exploitable vulnerabilities through hands-on security testing. REPORTS all security findings from actual exploit attempts.

## Usage

```bash
/pen-test
```text

## Description

Performs active penetration testing using the `security-engineer` agent with hands-on exploitation attempts. Uses **REPORT all findings** strategy to provide comprehensive security validation through simulated attacks and vulnerability exploitation.

---

## Execution Flow

### Step 1: Penetration Testing Analysis

**Agent**: `security-engineer` (penetration testing mode)

**Process**:

- Active vulnerability scanning and exploitation
- Authentication and authorization bypass attempts
- Input validation testing with malicious payloads
- Business logic vulnerability assessment
- Infrastructure penetration testing

---

## Penetration Testing Areas

### Authentication Penetration Testing

**Attack Vectors**:

- Brute force attack simulation
- Session hijacking attempts
- Token manipulation testing
- Password reset vulnerabilities
- Multi-factor authentication bypass

**Testing Scenarios**:

- ✅ **Brute Force Protection**: Rate limiting effectiveness
- ✅ **Session Security**: Session fixation and hijacking
- ✅ **Token Security**: JWT manipulation and validation
- ✅ **Password Reset**: Reset token security
- ✅ **Account Lockout**: Lockout mechanism testing

**Exploit Attempts**:

```bash

# Brute force simulation

POST /api/auth/login
Content-Type: application/json
{
  "email": "admin@example.com",
  "password": "password123"
}

# Repeat with common passwords

# Session manipulation

Cookie: session_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# Attempt token modification

# Password reset exploitation

POST /api/auth/reset-password
{
  "token": "manipulated_reset_token",
  "password": "newpassword"
}
```text

### Authorization Penetration Testing

**Attack Vectors**:

- Privilege escalation attempts
- Horizontal access control bypass
- Vertical access control bypass
- Resource access manipulation
- Admin function exploitation

**Testing Scenarios**:

- ✅ **Role Escalation**: User attempting admin functions
- ✅ **Resource Access**: Accessing other users' data
- ✅ **Direct Object References**: IDOR vulnerability testing
- ✅ **Function-Level Access**: Unauthorized function calls
- ✅ **Admin Panel Access**: Admin interface security

**Exploit Attempts**:

```bash

# Privilege escalation attempt

PUT /api/users/123
Authorization: Bearer user_token
{
  "role": "admin"
}

# Horizontal access control bypass

GET /api/accommodations/456
Authorization: Bearer user_token

# Attempt to access accommodation owned by different user

# IDOR testing

GET /api/bookings/789

# Test sequential ID access without authorization

```text

### Input Validation Penetration Testing

**Attack Vectors**:

- SQL injection exploitation
- Cross-site scripting (XSS) attacks
- Command injection attempts
- Path traversal testing
- File upload exploitation

**Testing Scenarios**:

- ✅ **SQL Injection**: Database manipulation attempts
- ✅ **XSS Attacks**: Script injection testing
- ✅ **Command Injection**: System command execution
- ✅ **Path Traversal**: File system access attempts
- ✅ **File Upload**: Malicious file upload testing

**Exploit Attempts**:

```bash

# SQL injection testing

POST /api/accommodations/search
{
  "query": "'; DROP TABLE users; --"
}

# XSS payload testing

POST /api/reviews
{
  "content": "<script>alert('XSS')</script>"
}

# Path traversal testing

GET /api/files?path=../../../../etc/passwd

# Command injection

POST /api/utils/ping
{
  "host": "google.com; cat /etc/passwd"
}
```text

### Business Logic Penetration Testing

**Attack Vectors**:

- Price manipulation attacks
- Workflow bypass attempts
- Race condition exploitation
- Logic flaw identification
- State manipulation testing

**Testing Scenarios**:

- ✅ **Payment Bypass**: Booking without payment
- ✅ **Price Manipulation**: Negative or zero prices
- ✅ **Workflow Bypass**: Skipping validation steps
- ✅ **Race Conditions**: Concurrent request exploitation
- ✅ **State Manipulation**: Invalid state transitions

**Exploit Attempts**:

```bash

# Price manipulation

POST /api/bookings
{
  "accommodationId": "123",
  "price": -100,
  "dates": ["2024-01-01", "2024-01-02"]
}

# Race condition testing

# Send multiple concurrent requests

for i in {1..10}; do
  curl -X POST /api/bookings -d '{"accommodationId":"123"}' &
done

# Workflow bypass

POST /api/bookings/confirm
{
  "bookingId": "456"
}

# Without payment step

```text

### API Security Penetration Testing

**Attack Vectors**:

- Rate limiting bypass
- API versioning exploitation
- CORS policy testing
- HTTP method manipulation
- Header injection attacks

**Testing Scenarios**:

- ✅ **Rate Limit Bypass**: Circumventing rate limits
- ✅ **CORS Exploitation**: Cross-origin attack testing
- ✅ **HTTP Method Override**: Unauthorized method access
- ✅ **Header Injection**: Malicious header injection
- ✅ **API Versioning**: Version-specific vulnerabilities

**Exploit Attempts**:

```bash

# Rate limiting bypass

for i in {1..1000}; do
  curl -H "X-Forwarded-For: 192.168.1.$i" /api/auth/login
done

# CORS testing

curl -H "Origin: https://evil.com" /api/sensitive-data

# HTTP method override

POST /api/accommodations/123
X-HTTP-Method-Override: DELETE

# Header injection

GET /api/data
User-Agent: Mozilla/5.0\r\nX-Admin: true
```text

---

## Output Format

### Success Case (Secure)

```text
✅ PENETRATION TEST COMPLETE - SECURE

Authentication Testing:
✅ Brute Force Protection: Rate limiting blocks attacks after 5 attempts
✅ Session Security: Sessions properly invalidated, no hijacking possible
✅ Token Security: JWT properly validated, manipulation detected
✅ Password Reset: Reset tokens secure, no bypass possible
✅ Account Lockout: Proper lockout after failed attempts

Authorization Testing:
✅ Privilege Escalation: Role changes properly blocked
✅ Horizontal Access Control: Users cannot access others' data
✅ IDOR Protection: Object references properly validated
✅ Function-Level Access: Admin functions protected
✅ Admin Panel Security: Admin access properly secured

Input Validation Testing:
✅ SQL Injection Protection: Parameterized queries prevent injection
✅ XSS Prevention: Output properly encoded, scripts blocked
✅ Command Injection Protection: Input sanitized, commands blocked
✅ Path Traversal Protection: File access properly restricted
✅ File Upload Security: Malicious files blocked

Business Logic Testing:
✅ Payment Logic: Cannot bypass payment requirements
✅ Price Validation: Negative prices rejected
✅ Workflow Integrity: Cannot skip validation steps
✅ Race Condition Protection: Concurrent requests handled safely
✅ State Management: Invalid transitions blocked

API Security Testing:
✅ Rate Limiting: Effective protection against abuse
✅ CORS Policy: Proper origin restrictions enforced
✅ HTTP Method Security: Method override blocked
✅ Header Validation: Malicious headers rejected
✅ API Versioning: No version-specific vulnerabilities

🔒 Application successfully resists penetration attempts
```text

### Vulnerabilities Found Case

```text
🚨 PENETRATION TEST - VULNERABILITIES EXPLOITED

Authentication Testing:
❌ CRITICAL: Brute force attack successful
   Endpoint: POST /api/auth/login
   Exploit: No rate limiting on authentication endpoint
   Result: Successfully brute forced admin account in 15 minutes
   Impact: Complete admin access compromise
   Fix: Implement strict rate limiting (3 attempts per 15 minutes)

Authorization Testing:
❌ HIGH: Privilege escalation exploit successful
   Endpoint: PUT /api/users/profile
   Exploit: Role field not filtered from user input
   Result: Successfully escalated user to admin role
   Impact: Unauthorized admin access
   Fix: Filter role field from user-modifiable data

❌ HIGH: IDOR vulnerability exploited
   Endpoint: GET /api/bookings/{id}
   Exploit: Sequential ID enumeration without authorization
   Result: Accessed all users' booking data
   Impact: Complete booking data exposure
   Fix: Implement proper authorization checks

Input Validation Testing:
❌ CRITICAL: SQL injection exploit successful
   Endpoint: POST /api/accommodations/search
   Exploit: Union-based SQL injection in search query
   Result: Extracted entire users table including passwords
   Impact: Complete database compromise
   Fix: Use parameterized queries, remove raw SQL

⚠️ MEDIUM: Stored XSS vulnerability
   Endpoint: POST /api/reviews
   Exploit: JavaScript payload in review content
   Result: Script executes for all users viewing reviews
   Impact: Session hijacking potential
   Fix: Implement proper HTML sanitization

Business Logic Testing:
❌ HIGH: Payment bypass exploit successful
   Endpoint: POST /api/bookings/confirm
   Exploit: Direct booking confirmation without payment
   Result: Created confirmed bookings without payment
   Impact: Financial loss through unpaid bookings
   Fix: Validate payment status before confirmation

⚠️ MEDIUM: Race condition exploited
   Endpoint: POST /api/bookings
   Exploit: Concurrent requests for same dates
   Result: Double-booked accommodation for same dates
   Impact: Booking conflicts and customer issues
   Fix: Implement proper locking mechanism

API Security Testing:
⚠️ MEDIUM: Rate limiting bypass successful
   Method: IP rotation using X-Forwarded-For header
   Result: Bypassed rate limits with spoofed IPs
   Impact: Potential for API abuse
   Fix: Use multiple rate limiting strategies

Penetration Test Summary:

- Critical Exploits: 2 (immediate security risk)
- High Risk Exploits: 3 (significant security impact)
- Medium Risk Exploits: 3 (moderate security concern)

🚨 CRITICAL: System compromised - fix immediately before deployment
```text

---

## Exploitation Techniques

### Authentication Exploitation

**Techniques Used**:

- Dictionary attacks on login endpoints
- Session token manipulation and replay
- JWT token tampering and signature bypass
- Password reset token manipulation
- Account enumeration testing

**Tools Simulated**:

- Brute force tools (Hydra, Burp Suite)
- Token manipulation tools
- Session analysis tools

### Authorization Exploitation

**Techniques Used**:

- Parameter pollution for privilege escalation
- Direct object reference manipulation
- Function-level access testing
- Role-based access control bypass
- Administrative interface testing

**Tools Simulated**:

- Authorization testing tools
- Parameter manipulation tools
- Access control scanners

### Input Validation Exploitation

**Techniques Used**:

- SQL injection with UNION queries
- Blind SQL injection techniques
- Reflected and stored XSS
- Command injection payloads
- Path traversal sequences

**Tools Simulated**:

- SQLMap for SQL injection
- XSS payload generators
- Command injection tools

### Business Logic Exploitation

**Techniques Used**:

- Workflow manipulation
- Race condition exploitation
- Price and quantity manipulation
- State transition attacks
- Logic flaw identification

**Tools Simulated**:

- Burp Suite for workflow testing
- Custom scripts for race conditions
- Business logic testing tools

---

## Risk Assessment

### Critical Exploits

**Immediate Action Required**:

- Remote code execution
- Authentication bypass
- Complete data exposure
- System compromise
- Financial impact exploits

### High Risk Exploits

**Fix Before Production**:

- Privilege escalation
- Significant data exposure
- User account compromise
- Payment system exploitation
- Administrative access bypass

### Medium Risk Exploits

**Address Soon**:

- Limited data exposure
- Rate limiting bypass
- Cross-site scripting
- Information disclosure
- Service disruption potential

### Low Risk Exploits

**Nice to Fix**:

- Information gathering
- Minor logic flaws
- Configuration issues
- Non-critical functionality bypass

---

## Remediation Priorities

### Immediate Fixes (Critical)

1. Stop SQL injection vulnerabilities
2. Fix authentication bypass
3. Prevent privilege escalation
4. Secure payment logic
5. Block remote code execution

### Short-term Fixes (High)

1. Implement proper authorization
2. Fix IDOR vulnerabilities
3. Secure admin functions
4. Validate business logic
5. Strengthen input validation

### Medium-term Fixes

1. Enhance rate limiting
2. Improve error handling
3. Strengthen session management
4. Add security headers
5. Implement security monitoring

---

## Related Commands

- `/review-security` - Static security analysis
- `/quality-check` - Includes penetration testing
- `/review-code` - Code security patterns

---

## When to Use

- **Before Production**: Final security validation
- **Regular Security Audits**: Periodic penetration testing
- **After Security Changes**: Validation of security improvements
- **Compliance Requirements**: Meeting security audit requirements

---

## Prerequisites

- Application functionality complete
- Authentication and authorization implemented
- Test environment configured for safe testing

---

## Post-Command Actions

**If No Exploits**: Deploy with security confidence

**If Exploits Found**:

1. **Critical**: Fix immediately, re-test before deployment
2. **High Risk**: Fix before production deployment
3. **Medium Risk**: Plan security fixes in next sprint
4. **Low Risk**: Address during regular security maintenance

**Security Monitoring**: Implement detection for attempted exploits

**Documentation**: Update security incident response procedures

