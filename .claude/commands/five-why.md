---
name: five-why
description: Root cause analysis using the Five Whys technique, systematically identifying underlying causes of problems and proposing solutions with tradeoffs via the debugger agent
---

# Five Why Command

## Purpose

Root cause analysis using the Five Whys technique to systematically identify
underlying causes of problems, bugs, or architectural decisions. Provides
structured problem-solving with solution options and tradeoff analysis.

## Usage

```bash
/five-why {problem_description}
```

### Examples

```bash
/five-why "Users experiencing slow search results"
/five-why "API endpoint returning 500 errors intermittently"
/five-why "Memory usage increasing over time in production"
/five-why "Deploy pipeline failing on staging environment"
```

## Description

Conducts systematic Five Whys root cause analysis using the `debugger` agent.
Iteratively asks "Why?" to drill down from symptoms to root causes, then
proposes solutions with tradeoffs for user consideration.

---

## Execution Flow

### Step 1: Problem Analysis

**Agent**: `debugger`

**Process**:

- Analyze the presented problem or decision
- Gather context and related information
- Identify symptoms vs. underlying causes
- Prepare for systematic questioning

### Step 2: Five Whys Analysis

**Process**:

1. **Problem Statement**: Clear definition of the issue
2. **Why #1**: First level - immediate cause
3. **Why #2**: Second level - underlying cause
4. **Why #3**: Third level - deeper cause
5. **Why #4**: Fourth level - systemic cause
6. **Why #5**: Fifth level - root cause

### Step 3: Root Cause Identification

**Process**:

- Identify the fundamental root cause
- Validate root cause logic
- Assess impact and scope
- Categorize problem type

### Step 4: Solution Development

**Process**:

- Generate multiple solution options
- Analyze tradeoffs for each solution
- Assess implementation complexity
- Present recommendations with rationale

---

## Five Whys Framework

### Problem Categories

#### Technical Problems

**Common Areas**:

- Bug investigation and resolution
- Performance issues and bottlenecks
- Architecture decision analysis
- Integration failures
- Deployment problems

**Analysis Focus**:

- Code-level root causes
- System design issues
- Configuration problems
- Dependency conflicts
- Resource limitations

#### Process Problems

**Common Areas**:

- Development workflow issues
- Communication breakdowns
- Quality assurance gaps
- Deployment process failures
- Team coordination problems

**Analysis Focus**:

- Workflow design flaws
- Tool and process gaps
- Communication patterns
- Knowledge gaps
- Resource allocation

#### System Problems

**Common Areas**:

- Scalability limitations
- Reliability issues
- Security vulnerabilities
- Maintenance challenges
- User experience problems

**Analysis Focus**:

- System architecture design
- Infrastructure limitations
- Security model gaps
- Operational procedures
- User interaction patterns

---

## Output Format

### Complete Five Whys Analysis

```text
FIVE WHYS ANALYSIS COMPLETE

Problem: Users experiencing slow search results on the search page

Five Whys Analysis:

Why #1: Why are search results slow?
  Answer: Database queries are taking 2-3 seconds to execute
  Context: Database query logs show high execution times
  Evidence: Average query time increased from 200ms to 2.8s

Why #2: Why are database queries slow?
  Answer: Missing indexes on frequently queried columns
  Context: Query execution plan shows table scans instead of index usage
  Evidence: EXPLAIN ANALYZE shows sequential scans on 100k+ records

Why #3: Why are indexes missing on frequently queried columns?
  Answer: Recent schema changes added new search filters without indexes
  Context: Location and price range filters added without index optimization
  Evidence: Git history shows schema changes without index additions

Why #4: Why were indexes not added with schema changes?
  Answer: Database migration process does not include performance review
  Context: Current process focuses on schema correctness, not performance
  Evidence: Migration checklist lacks index and performance validation

Why #5: Why does the migration process not include performance review?
  Answer: Performance considerations were not prioritized in the workflow
  Context: Fast development was prioritized over database optimization
  Evidence: No performance testing in CI/CD pipeline

ROOT CAUSE IDENTIFIED:
Lack of performance-focused database migration process and performance testing

Impact Assessment:
  Severity: High (affects all search operations)
  Scope: All search functionality
  Users Affected: 100% of search users
  Business Impact: Potential user drop-off due to poor experience

Solution Options with Tradeoffs:

Option 1: Immediate Fix + Process Improvement
  Pros:
    - Quick resolution of current issue
    - Prevents similar future issues
    - Improves overall development quality
  Cons:
    - Requires immediate development time
    - Need to update existing processes
    - Team training required
  Implementation:
    1. Add missing indexes for current schema (2 hours)
    2. Update migration checklist with performance review (1 hour)
    3. Add database performance testing to CI/CD (4 hours)
    4. Create database optimization guidelines (2 hours)

Option 2: Quick Fix Only
  Pros:
    - Fastest resolution (2 hours)
    - No process changes required
    - Immediate user experience improvement
  Cons:
    - Problem likely to recur
    - No systematic improvement
    - Technical debt accumulation
  Implementation:
    1. Add missing indexes immediately (2 hours)

Option 3: Comprehensive Database Optimization
  Pros:
    - Complete database performance overhaul
    - Long-term performance benefits
    - Systematic approach to optimization
  Cons:
    - Significant time investment (40+ hours)
    - Higher risk of introducing issues
    - Delayed user experience fix
  Implementation:
    1. Complete database performance audit (16 hours)
    2. Implement all optimization recommendations (20 hours)
    3. Update all development processes (8 hours)

RECOMMENDED SOLUTION: Option 1 (Immediate Fix + Process Improvement)

Rationale:
  - Balances immediate user needs with long-term quality
  - Prevents recurrence without over-engineering
  - Reasonable time investment with clear ROI
  - Addresses root cause systematically

Next Steps:
  1. Implement immediate database indexes
  2. Update migration process documentation
  3. Add performance testing to CI/CD pipeline
  4. Schedule team training on database performance
```

---

## Analysis Techniques

### Systematic Questioning

#### Question Formulation

- **Open-ended Questions**: Avoid yes/no answers
- **Evidence-based**: Ask for concrete evidence
- **Context Gathering**: Understand surrounding circumstances
- **Assumption Challenging**: Question underlying assumptions

#### Common Question Patterns

```text
Technical Analysis:
  - Why is [system/component] behaving this way?
  - What changed that could cause this behavior?
  - Where in the process does the problem manifest?
  - When did this problem first appear?

Process Analysis:
  - Why was this not caught earlier in the process?
  - What steps were skipped or inadequate?
  - How did the current process allow this to happen?

System Analysis:
  - Why does the system have this limitation?
  - What design decisions led to this constraint?
  - How does this relate to other system components?
  - What assumptions were made during design?
```

### Evidence Collection

#### Data-Driven Analysis

- **Logs and Metrics**: Concrete evidence from system logs
- **Performance Data**: Quantitative measurements
- **User Reports**: Qualitative feedback and observations
- **Code History**: Git commits and change patterns
- **Configuration Changes**: System and deployment changes

#### Verification Methods

- **Reproduction Steps**: Can the problem be reproduced?
- **Timeline Analysis**: When did the problem start?
- **Impact Measurement**: How widespread is the issue?
- **Correlation Analysis**: What else changed at the same time?

---

## Common Use Cases

### Bug Investigation

```text
Problem: API endpoint returning 500 errors

Why #1: Why are we getting 500 errors?
  -> Database connection is failing

Why #2: Why is database connection failing?
  -> Connection pool is exhausted

Why #3: Why is connection pool exhausted?
  -> Connections are not being properly released

Why #4: Why are connections not being released?
  -> Service methods are not using try/finally blocks

Why #5: Why are proper connection patterns not used?
  -> No code review checklist for database patterns

Root Cause: Missing database connection management standards
```

### Performance Issues

```text
Problem: Dashboard loading takes 15+ seconds

Why #1: Why is dashboard slow?
  -> Multiple API calls block rendering

Why #2: Why are multiple API calls blocking?
  -> Sequential API calls instead of parallel

Why #3: Why are calls sequential instead of parallel?
  -> Component uses chained async calls

Why #4: Why does component use chained calls?
  -> Developer unfamiliar with parallel execution patterns

Why #5: Why was this not caught in review?
  -> No performance testing in development process

Root Cause: Lack of performance awareness in development workflow
```

### Architecture Decisions

```text
Problem: Microservices causing deployment complexity

Why #1: Why is deployment complex?
  -> Multiple services need coordinated releases

Why #2: Why do services need coordinated releases?
  -> Tight coupling between service APIs

Why #3: Why are services tightly coupled?
  -> Shared database and synchronous communication

Why #4: Why do services share database?
  -> Initial design prioritized development speed

Why #5: Why was development speed prioritized over architecture?
  -> Pressure to deliver MVP quickly without architecture planning

Root Cause: Insufficient architecture planning in early development
```

---

## Solution Development Framework

### Solution Categories

#### Immediate Fixes

**Characteristics**:

- Address symptoms quickly
- Low risk implementation
- Minimal process changes
- Fast user benefit

**When to Use**:

- Critical production issues
- User-impacting problems
- Time-sensitive fixes
- Clear technical solutions

#### Process Improvements

**Characteristics**:

- Address systematic causes
- Prevent recurrence
- Require team adoption
- Long-term benefits

**When to Use**:

- Recurring problems
- Quality improvement needs
- Workflow optimization
- Team capability building

#### Architectural Changes

**Characteristics**:

- Address fundamental limitations
- Significant implementation effort
- Long-term strategic benefits
- Higher risk and complexity

**When to Use**:

- Scalability limitations
- Security requirements
- Performance bottlenecks
- Technology evolution

### Tradeoff Analysis

#### Factors Assessed

**Effort**:

- Development time required
- Testing and validation time
- Deployment complexity
- Documentation updates
- Team training needs

**Risk**:

- Technical implementation risk
- User experience impact
- Business continuity risk
- Regression possibilities
- Long-term maintenance burden

**Benefit**:

- User experience improvement
- System reliability gains
- Development efficiency gains
- Business value creation
- Technical debt reduction

---

## Related Commands

- `/code-check` - Validate fixes after root cause resolution
- `/run-tests` - Verify fixes with tests
- `/quality-check` - Full quality validation after implementing solution
- `/security-audit` - If root cause involves security issues
- `/performance-audit` - If root cause involves performance issues

---

## When to Use

- **Bug Investigation**: Understanding root causes of defects
- **Performance Analysis**: Identifying performance bottlenecks
- **Process Problems**: Analyzing workflow or development issues
- **Architecture Decisions**: Understanding design choice implications
- **Incident Analysis**: Post-mortem root cause analysis

---

## Prerequisites

- Clear problem description
- Access to relevant logs and data
- Understanding of system context
- Time for thorough analysis (30-60 minutes)

---

## Post-Command Actions

1. **Review Analysis**: Validate Five Whys logic and conclusions
2. **Solution Selection**: Choose appropriate solution option
3. **Implementation Planning**: Plan chosen solution execution
4. **Monitoring**: Track solution effectiveness
5. **Learning Documentation**: Update knowledge base with insights

---

## Best Practices

### Analysis Quality

- Ask "Why?" not "Who?" (focus on process, not blame)
- Use evidence-based reasoning
- Challenge assumptions at each level
- Validate each "Why" with concrete evidence
- Stop when you reach an actionable root cause

### Solution Development

- Generate multiple solution options (minimum 2-3)
- Consider short-term and long-term approaches
- Assess implementation effort realistically
- Include process improvements, not just technical fixes
- Present clear tradeoffs for decision making
