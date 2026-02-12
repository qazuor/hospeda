---
name: update-docs
description: Comprehensive documentation update and maintenance using tech-writer skill, covering API docs, component docs, architecture docs, and development guides
---

# Update Docs Command

## Purpose

Comprehensive documentation update and maintenance for the project. Ensures all
documentation remains current, accurate, and useful for development and
maintenance. Uses the `tech-writer` skill for professional documentation output.

## Usage

```bash
/update-docs
```

## Description

Orchestrates complete documentation review and updates using the `tech-writer`
skill. Covers API documentation, component guides, architecture documentation,
and development guides to maintain a comprehensive project knowledge base.

---

## Execution Flow

### Step 1: Documentation Analysis

**Skill**: `tech-writer`

**Process**:

- Audit existing documentation for completeness and accuracy
- Identify outdated or missing documentation
- Review code changes for documentation impacts
- Assess documentation quality and usability
- Plan documentation updates and improvements

---

## Documentation Areas

### API Documentation

**Scope**:

- OpenAPI/Swagger specifications
- Endpoint documentation
- Authentication guides
- Rate limiting documentation
- Error response documentation
- Request/response examples

**Update Requirements**:

- **Current Endpoints**: All endpoints documented
- **Request/Response**: Complete schemas and examples
- **Authentication**: Current auth flow documentation
- **Error Codes**: All error responses documented
- **Rate Limits**: Current rate limiting policies

### Component Documentation

**Scope**:

- UI component documentation
- Component API references (props, events, slots)
- Usage examples and patterns
- Accessibility documentation
- Design system integration

**Update Requirements**:

- **Component APIs**: Props, events, and methods documented
- **Usage Examples**: Code examples for each component
- **Accessibility**: WCAG compliance documentation
- **Design System**: Consistent design token usage
- **Best Practices**: Component usage guidelines

### Architecture Documentation

**Scope**:

- System architecture overview
- Database schema documentation
- Service layer patterns
- API design patterns
- Frontend architecture

**Update Requirements**:

- **Current Architecture**: Reflects actual system design
- **Pattern Documentation**: All patterns clearly explained
- **Decision Records**: Architecture decisions documented
- **Migration Guides**: Instructions for major changes
- **Best Practices**: Development guidelines current

### Development Documentation

**Scope**:

- Setup and installation guides
- Development workflow documentation
- Testing documentation
- Deployment guides
- Troubleshooting guides

**Update Requirements**:

- **Setup Instructions**: Current and tested setup steps
- **Workflow Guide**: Updated development processes
- **Testing Guide**: Current testing practices
- **Deployment**: Updated deployment procedures
- **Troubleshooting**: Common issues and solutions

---

## Documentation Quality Standards

### Content Quality

- **Accuracy**: All information current and correct
- **Completeness**: No missing critical information
- **Clarity**: Easy to understand and follow
- **Examples**: Practical, working examples provided
- **Structure**: Logical organization and navigation

### Technical Standards

- **Markdown**: Consistent markdown formatting
- **Code Blocks**: Proper syntax highlighting
- **Links**: All internal and external links working
- **Images**: Optimized and accessible images (alt text)
- **Formatting**: Consistent formatting patterns

### Maintenance Standards

- **Version Sync**: Documentation matches code version
- **Regular Updates**: Documentation updated with code changes
- **Review Process**: Documentation included in code reviews
- **User Feedback**: Documentation improved based on feedback
- **Search**: Documentation easily searchable

---

## Output Format

### Success Case

```text
DOCUMENTATION UPDATE COMPLETE

Documentation Review Summary:
  Files Reviewed: 87 documentation files
  Updated Files: 23 files updated
  New Files: 5 new documentation files created
  Fixed Links: 12 broken links repaired

API Documentation:
  OpenAPI Spec: Updated with 3 new endpoints
  Authentication Guide: Updated integration steps
  Error Documentation: Added 8 new error codes
  Examples: 15 new request/response examples

Component Documentation:
  Components: 12 components documented
  Design System: Updated with new design tokens
  Accessibility: WCAG AA compliance documented

Architecture Documentation:
  Database Schema: Updated with 3 new entities
  Service Patterns: Documented new service methods
  API Patterns: Updated route documentation
  Migration Guide: Added upgrade instructions

Development Documentation:
  Setup Guide: Updated with latest requirements
  Testing Guide: Added new testing patterns
  Troubleshooting: 12 new solutions added

Quality Metrics:
  Accuracy: 100% information verified
  Completeness: 95% coverage (target met)
  Link Health: 100% links working
  Formatting: Consistent markdown formatting

Documentation ready for team use
```

### Issues Found Case

```text
DOCUMENTATION UPDATE - ISSUES IDENTIFIED

Critical Issues:
  API Documentation: 5 endpoints missing documentation
    Missing: POST /api/payments/webhook, GET /api/admin/analytics
    Impact: Developers cannot integrate new features
    Fix: Create complete endpoint documentation with examples

  Setup Guide: Outdated runtime version requirements
    Current Doc: Node.js 16+
    Actual Requirement: Node.js 20+
    Impact: Setup failures for new developers
    Fix: Update all version references

High Priority Issues:
  Component Documentation: 8 components missing docs
    Impact: Frontend developers cannot use components effectively
    Fix: Create component documentation with props and examples

  Database Schema: Outdated relationship diagrams
    Issue: Missing 3 new entities added in last sprint
    Impact: Architects cannot understand current system
    Fix: Update ER diagrams and relationship documentation

Medium Priority Issues:
  Broken Links: 15 internal links not working
    Cause: File reorganization
    Impact: Navigation issues in documentation
    Fix: Update link references

  Example Code: 12 code examples outdated
    Issue: Examples use old API format
    Impact: Developers copy incorrect patterns
    Fix: Update examples with current API format

Documentation Health Summary:
  Critical Issues: 2 (fix immediately)
  High Priority: 2 (fix this sprint)
  Medium Priority: 2 (fix next sprint)
  Coverage: 78% (target: 95%)

Address critical issues before next release
```

---

## Documentation Types

### API Reference Documentation

**Required Sections**:

- Authentication and authorization
- Endpoint specifications (OpenAPI)
- Request/response examples
- Error codes and handling
- Rate limiting and quotas
- SDK and client library guides

**Quality Criteria**:

- Complete endpoint coverage
- Working code examples
- Clear error explanations
- Up-to-date authentication flows

### UI Component Documentation

**Required Sections**:

- Component purpose and usage
- Props/attributes specification
- Event handling documentation
- Accessibility guidelines
- Styling and theming options
- Integration examples

**Quality Criteria**:

- Interactive examples (Storybook or similar)
- Accessibility compliance notes
- Mobile responsiveness documentation
- Performance considerations

### System Architecture Documentation

**Required Sections**:

- System overview and goals
- Layer separation and boundaries
- Data flow diagrams
- Security architecture
- Scalability considerations
- Technology decisions

**Quality Criteria**:

- Current architecture reflection
- Clear diagrams and visuals
- Decision rationale documented
- Migration and upgrade paths

### Developer Setup Documentation

**Required Sections**:

- Environment setup instructions
- Development workflow processes
- Code style and standards
- Testing strategies and tools
- Deployment procedures
- Troubleshooting guides

**Quality Criteria**:

- Tested setup instructions
- Clear workflow explanations
- Comprehensive troubleshooting
- Tool-specific guidance

---

## Documentation Automation

### Automated Generation

**API Documentation**:

- OpenAPI spec generation from code
- Endpoint documentation from routes
- Type definitions from schemas
- Example generation from tests

**Component Documentation**:

- Props documentation from TypeScript
- Usage examples from Storybook (if available)
- Accessibility reports from testing tools
- Performance metrics from audits

### Validation Automation

**Link Checking**:

- Internal link validation
- External link health checks
- Image reference validation
- Code example compilation

**Content Validation**:

- Spelling and grammar checks
- Code syntax validation
- Markdown formatting validation
- Documentation coverage reports

---

## Documentation Maintenance

### Regular Updates

**Code Changes**:

- API changes -> Update API docs
- Component changes -> Update component docs
- Architecture changes -> Update architecture docs
- Process changes -> Update development docs

**Scheduled Reviews**:

- Monthly documentation review
- Quarterly comprehensive audit
- Release-based documentation updates

### Quality Monitoring

**Metrics Tracking**:

- Documentation coverage percentage
- Link health monitoring
- User feedback and usage analytics
- Documentation update frequency

---

## Related Commands

- `/quality-check` - Includes documentation validation
- `/add-new-entity` - Requires documentation updates for new entities
- `/commit` - Commit documentation changes

---

## When to Use

- **After Major Features**: Update docs for new functionality
- **Regular Maintenance**: Monthly documentation review
- **Before Releases**: Ensure all docs current for release
- **Onboarding Preparation**: Update guides for new team members

---

## Prerequisites

- Recent code changes understood
- Access to all documentation files
- Current understanding of system architecture

---

## Post-Command Actions

1. **Review Updates**: Validate all documentation changes
2. **Team Communication**: Notify team of documentation updates
3. **User Testing**: Test documentation with new users
4. **Search Optimization**: Update documentation search indexes

---

## Documentation Best Practices

### Writing Guidelines

- Use clear, concise language
- Include practical examples
- Maintain consistent tone and style
- Structure content logically
- Use active voice when possible

### Technical Guidelines

- Keep code examples current
- Use proper markdown formatting
- Optimize images for web
- Maintain consistent naming
- Include proper metadata

### Maintenance Guidelines

- Update docs with code changes
- Review docs during code reviews
- Collect and integrate user feedback
- Monitor documentation usage metrics
- Plan regular documentation audits
