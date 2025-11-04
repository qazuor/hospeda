# TODO List: AI-Powered Mockup Generation

**Related Documents:**

- [PDR (Product Design Requirements)](./PDR.md)
- [Technical Analysis](./tech-analysis.md)

**Feature Status**: Not Started
**Start Date**: TBD
**Target Date**: TBD (est. 3 days)
**Actual Completion**: TBD

---

## Progress Summary

**Overall Progress**: 0% complete

| Priority | Total | Completed | In Progress | Not Started |
|----------|-------|-----------|-------------|-------------|
| P0 | 9 | 0 | 0 | 9 |
| P1 | 11 | 0 | 0 | 11 |
| P2 | 0 | 0 | 0 | 0 |
| P3 | 0 | 0 | 0 | 0 |
| **Total** | **20** | **0** | **0** | **20** |

**Velocity**: TBD tasks per day (average)

---

## Phase 1: Planning ✅ Completed

### ✅ Planning Tasks

- [x] **[2h]** Create PDR.md with user stories and acceptance criteria
  - Completed: 2025-10-31 by @tech-lead
  - Notes: Comprehensive PDR with 3 user stories, acceptance criteria, and mockup specifications

- [x] **[3h]** Create technical analysis document
  - Completed: 2025-10-31 by @tech-lead
  - Notes: Detailed tech analysis with architecture, integration points, and task breakdown

- [x] **[1h]** Research Replicate.com API and FLUX models
  - Completed: 2025-10-31 by @tech-lead
  - Notes: Selected FLUX.1 [schnell] model ($0.003/image, 50 free/month)

- [x] **[0.5h]** Create planning session structure
  - Completed: 2025-10-31 by @tech-lead
  - Notes: Created P-005-mockup-generation folder with mockups/ subfolder

---

## Phase 2: Implementation 🔄 Not Started

### P0 - Critical (Must Have)

#### Setup & Dependencies

- [x] **[PF-005-1]** **[1h]** Install and configure Replicate SDK
  - **Dependencies**: None
  - **Assignee**: @node-typescript-engineer
  - **Status**: ✅ Complete
  - **Completed**: 2025-11-04
  - **Commit**: 918ab65e
  - **Tasks**:
    - ✅ Install `replicate@^0.25.0` package
    - ✅ Verify SDK imports and TypeScript definitions
    - ✅ Test authentication with API token
  - **Acceptance Criteria**:
    - ✅ Package installed in package.json
    - ✅ Can import Replicate class without errors
    - ✅ API token auth works (test with simple prediction)

- [x] **[PF-005-2]** **[1h]** Install and configure Sharp for image processing
  - **Dependencies**: None
  - **Assignee**: @node-typescript-engineer
  - **Status**: ✅ Complete
  - **Completed**: 2025-11-04
  - **Commit**: 918ab65e
  - **Tasks**:
    - ✅ Install `sharp@^0.32.0` package
    - ✅ Test image compression functionality
    - ✅ Test image resizing functionality
  - **Acceptance Criteria**:
    - ✅ Sharp installed and working
    - ✅ Can compress PNG images
    - ✅ Can resize images to specified dimensions

- [x] **[PF-005-3]** **[1h]** Create environment variable configuration
  - **Dependencies**: None
  - **Assignee**: @node-typescript-engineer
  - **Status**: ✅ Complete
  - **Completed**: 2025-11-04
  - **Commit**: 918ab65e
  - **Tasks**:
    - ✅ Add `REPLICATE_API_TOKEN` to .env.example
    - ✅ Create config loader for mockup settings
    - ✅ Implement validation for required env vars
  - **Acceptance Criteria**:
    - ✅ .env.example updated with REPLICATE_API_TOKEN
    - ✅ Config loader reads env vars correctly
    - ✅ Missing API token throws clear error

- [x] **[PF-005-4]** **[1h]** Set up Replicate account and generate API token
  - **Dependencies**: None
  - **Assignee**: @tech-lead (manual task)
  - **Status**: ✅ Complete
  - **Completed**: 2025-11-04 (user configured)
  - **Tasks**:
    - ✅ Create Replicate.com account
    - ✅ Generate API token from dashboard
    - ✅ Add token to local .env file
    - ✅ Test token with simple API call
  - **Acceptance Criteria**:
    - ✅ Replicate account created
    - ✅ API token generated and stored securely
    - ✅ Token tested and working

#### Core Implementation

- [x] **[PF-005-5]** **[2h]** Implement MockupGenerator class
  - **Dependencies**: PF-005-1, PF-005-2, PF-005-3
  - **Assignee**: @node-typescript-engineer
  - **Status**: ✅ Complete
  - **File**: `packages/ai-image-generation/src/core/mockup-generator.ts`
  - **Completed**: 2025-11-04
  - **Commit**: 54e8506d
  - **Tasks**:
    - ✅ Create MockupGenerator class structure
    - ✅ Implement `generate()` method
    - ✅ Implement `downloadImage()` helper
    - ✅ Implement `processImage()` helper
    - ✅ Add error handling and retry logic
  - **Acceptance Criteria**:
    - ✅ Class instantiates with config
    - ✅ `generate()` calls Replicate API successfully
    - ✅ Image downloaded and saved to disk
    - ✅ Errors handled gracefully with retries

- [x] **[PF-005-6]** **[1h]** Implement prompt engineering utilities
  - **Dependencies**: PF-005-5
  - **Assignee**: @node-typescript-engineer
  - **Status**: ✅ Complete
  - **File**: `packages/ai-image-generation/src/utils/prompt-engineer.ts`
  - **Completed**: 2025-11-04
  - **Commit**: 54e8506d
  - **Tasks**:
    - ✅ Create `craftPrompt()` function
    - ✅ Implement UI/UX-specific prompt templates
    - ✅ Add prompt sanitization (remove harmful content)
    - ✅ Implement device-specific presets (desktop/mobile/tablet)
  - **Acceptance Criteria**:
    - ✅ Prompts include UI best practices
    - ✅ Harmful content filtered out
    - ✅ Device presets generate appropriate dimensions
    - ✅ Prompts are 1-500 characters

- [x] **[PF-005-7]** **[1h]** Implement file system management
  - **Dependencies**: PF-005-5
  - **Assignee**: @node-typescript-engineer
  - **Status**: ✅ Complete
  - **File**: `packages/ai-image-generation/src/utils/file-system-manager.ts`
  - **Completed**: 2025-11-04
  - **Commit**: 54e8506d
  - **Tasks**:
    - ✅ Create `FileSystemManager` class
    - ✅ Implement `ensureMockupsDir()` method
    - ✅ Implement `saveMockup()` method
    - ✅ Implement `generateFilename()` helper
    - ✅ Add permission error handling
  - **Acceptance Criteria**:
    - ✅ Mockups folder created if not exists
    - ✅ Files saved with descriptive names + timestamps
    - ✅ Name collisions avoided
    - ✅ Permission errors caught and reported

- [x] **[PF-005-8]** **[1h]** Implement metadata registry system
  - **Dependencies**: PF-005-7
  - **Assignee**: @node-typescript-engineer
  - **Status**: ✅ Complete
  - **File**: `packages/ai-image-generation/src/utils/metadata-registry.ts`
  - **Completed**: 2025-11-04
  - **Commit**: 54e8506d
  - **Tasks**:
    - ✅ Create `MetadataRegistry` class
    - ✅ Implement `load()` method
    - ✅ Implement `save()` method
    - ✅ Implement `addMockup()` method
    - ✅ Implement `updateReferences()` method
  - **Acceptance Criteria**:
    - ✅ Registry loads existing .registry.json
    - ✅ New mockups added to registry
    - ✅ Registry saved with proper formatting
    - ✅ Concurrent writes handled safely

- [x] **[PF-005-9]** **[1h]** Add error handling and retry logic
  - **Dependencies**: PF-005-5
  - **Assignee**: @node-typescript-engineer
  - **Status**: ✅ Complete
  - **File**: `packages/ai-image-generation/src/utils/error-handler.ts`
  - **Completed**: 2025-11-04
  - **Commit**: 54e8506d
  - **Tasks**:
    - ✅ Implement exponential backoff for retries
    - ✅ Add timeout handling (30s max)
    - ✅ Add rate limit detection and handling
    - ✅ Create error codes enum
    - ✅ Implement detailed error logging
  - **Acceptance Criteria**:
    - ✅ Network failures trigger 3 retries
    - ✅ Timeout after 30 seconds
    - ✅ Rate limit errors caught and logged
    - ✅ All errors include actionable messages

#### Agent Integration

- [x] **[PF-005-10]** **[2h]** Extend UX/UI Designer agent with mockup capabilities
  - **Dependencies**: PF-005-5, PF-005-6, PF-005-7, PF-005-8, PF-005-9
  - **Assignee**: @tech-lead
  - **Status**: ✅ Complete
  - **File**: `.claude/agents/design/ux-ui-designer.md`
  - **Completed**: 2025-11-04
  - **Commit**: d0c3fa3f
  - **Tasks**:
    - ✅ Import MockupGenerator in agent context
    - ✅ Add mockup generation instructions to agent prompt
    - ✅ Implement decision logic (when to generate mockups)
    - ✅ Add error handling for failed generations
  - **Acceptance Criteria**:
    - ✅ Agent can call MockupGenerator
    - ✅ Agent decides when mockups are helpful
    - ✅ Failed generations don't block planning
    - ✅ Agent explains mockup purpose in PDR

- [x] **[PF-005-11]** **[1h]** Add mockup references to PDR generation
  - **Dependencies**: PF-005-10
  - **Assignee**: @tech-lead
  - **Status**: ✅ Complete
  - **File**: `.claude/docs/templates/PDR-template.md`
  - **Completed**: 2025-11-04
  - **Commit**: d0c3fa3f
  - **Tasks**:
    - ✅ Generate markdown image syntax for mockups
    - ✅ Insert references in PDR section 3.2 or 3.3
    - ✅ Add image captions with descriptions
    - ✅ Update PDR template examples
  - **Acceptance Criteria**:
    - ✅ Mockups appear in PDR documents
    - ✅ Images render correctly in markdown
    - ✅ Captions explain mockup purpose
    - ✅ Relative paths are correct

- [x] **[PF-005-12]** **[1h]** Implement cost tracking and usage monitoring
  - **Dependencies**: PF-005-5
  - **Assignee**: @node-typescript-engineer
  - **Status**: ✅ Complete
  - **File**: `packages/ai-image-generation/src/utils/cost-tracker.ts`
  - **Completed**: 2025-11-04
  - **Commit**: d024265d, 7dd56ce2
  - **Tasks**:
    - ✅ Create `CostTracker` class
    - ✅ Track mockup count per month
    - ✅ Calculate total cost
    - ✅ Implement usage alerts (40/50 threshold)
    - ✅ Add monthly reset logic
  - **Acceptance Criteria**:
    - ✅ Usage tracked accurately
    - ✅ Cost calculated correctly ($0.003/image)
    - ✅ Alert triggered at 40 mockups
    - ✅ Monthly reset on first of month
  - **Test Coverage**: 97.93% (34 tests passing)

---

### P1 - High Priority (Should Have)

#### Testing

- [ ] **[PF-005-13]** **[1.5h]** Write unit tests for MockupGenerator
  - **Dependencies**: PF-005-5, PF-005-6, PF-005-7, PF-005-8, PF-005-9
  - **Assignee**: @qa-engineer
  - **Status**: Not Started
  - **File**: `.claude/agents/utils/__tests__/mockup-generator.test.ts`
  - **Tasks**:
    - Test `craftPrompt()` with various inputs
    - Test `generateFilename()` uniqueness
    - Test `processImage()` compression
    - Test error handling paths
    - Mock Replicate API calls
  - **Coverage Target**: 90%+
  - **Acceptance Criteria**:
    - All public methods tested
    - Edge cases covered
    - Mocks prevent actual API calls
    - Tests run in < 5 seconds

- [ ] **[PF-005-14]** **[2h]** Write integration tests for Replicate API
  - **Dependencies**: PF-005-5, PF-005-13
  - **Assignee**: @qa-engineer
  - **Status**: Not Started
  - **File**: `.claude/agents/utils/__tests__/replicate-integration.test.ts`
  - **Tasks**:
    - Test authentication with real API token
    - Test mockup generation end-to-end (skip in CI)
    - Test rate limit handling
    - Test network failure scenarios
    - Test timeout behavior
  - **Note**: Mark as `test.skip()` for CI, run manually
  - **Acceptance Criteria**:
    - Real API call succeeds
    - Rate limits detected properly
    - Timeouts handled correctly
    - Network errors caught

- [ ] **[PF-005-15]** **[2h]** Write E2E test for full workflow
  - **Dependencies**: PF-005-10, PF-005-11, PF-005-12
  - **Assignee**: @qa-engineer
  - **Status**: Not Started
  - **File**: `.claude/agents/__tests__/mockup-workflow.e2e.test.ts`
  - **Tasks**:
    - Create test planning session
    - Generate mockup via agent
    - Verify file created
    - Verify metadata updated
    - Verify PDR reference added
    - Clean up test artifacts
  - **Acceptance Criteria**:
    - End-to-end workflow completes
    - All artifacts created correctly
    - Metadata accurate
    - Cleanup successful

- [ ] **[PF-005-16]** **[1h]** Perform manual testing with various prompts
  - **Dependencies**: PF-005-10
  - **Assignee**: @ux-ui-designer
  - **Status**: Not Started
  - **Tasks**:
    - Test login screen mockup
    - Test dashboard mockup
    - Test mobile navigation mockup
    - Test very long description (edge case)
    - Test special characters in name
    - Evaluate mockup quality
  - **Acceptance Criteria**:
    - 5+ different mockups generated
    - Quality meets expectations (80%+ acceptable)
    - Edge cases handled gracefully
    - File sizes < 5MB

#### Documentation

- [ ] **[PF-005-17]** **[1h]** Update UX/UI Designer agent documentation
  - **Dependencies**: PF-005-10, PF-005-11
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **File**: `.claude/agents/design/ux-ui-designer.md`
  - **Tasks**:
    - Add mockup generation capability description
    - Document when agent generates mockups
    - Add example mockup references
    - Update agent capabilities list
  - **Acceptance Criteria**:
    - Documentation clear and complete
    - Examples provided
    - Capabilities list updated

- [ ] **[PF-005-18]** **[0.5h]** Create prompt engineering guidelines
  - **Dependencies**: PF-005-6, PF-005-16
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **File**: `.claude/docs/guides/mockup-prompt-engineering.md`
  - **Tasks**:
    - Document prompt best practices
    - Provide good/bad prompt examples
    - Explain device-specific presets
    - Add tips for quality mockups
  - **Acceptance Criteria**:
    - Guidelines comprehensive
    - Examples clear and helpful
    - Tips actionable

- [ ] **[PF-005-19]** **[0.5h]** Add environment setup guide
  - **Dependencies**: PF-005-3, PF-005-4
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **File**: `.claude/docs/guides/mockup-setup.md`
  - **Tasks**:
    - Document Replicate account setup
    - Explain API token generation
    - Show how to add token to .env
    - List optional configuration options
  - **Acceptance Criteria**:
    - Setup steps complete
    - Screenshots or examples included
    - Troubleshooting section added

- [ ] **[PF-005-20]** **[0.5h]** Create example mockup gallery
  - **Dependencies**: PF-005-16
  - **Assignee**: @ux-ui-designer
  - **Status**: Not Started
  - **File**: `.claude/docs/examples/mockup-gallery.md`
  - **Tasks**:
    - Curate 5-10 best mockups
    - Document prompt used for each
    - Show before/after (prompt → mockup)
    - Add quality tips based on examples
  - **Acceptance Criteria**:
    - Gallery showcases variety
    - Prompts documented
    - Quality tips included

---

## Phase 3: Validation ✅ Not Started

### Quality Assurance

- [ ] **[0.5h]** Run full test suite
  - **Dependencies**: PF-005-13, PF-005-14, PF-005-15
  - **Assignee**: @qa-engineer
  - **Status**: Not Started
  - **Tasks**:
    - Run all unit tests
    - Run integration tests
    - Run E2E test
    - Verify 90%+ coverage
  - **Acceptance Criteria**:
    - All tests pass
    - Coverage ≥ 90%
    - No flaky tests

- [ ] **[1h]** Perform security review
  - **Dependencies**: All implementation complete
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Tasks**:
    - Verify API key not logged or committed
    - Check prompt sanitization
    - Review error messages (no sensitive data)
    - Test rate limiting
  - **Acceptance Criteria**:
    - No API keys in logs or git
    - Prompt injection attempts blocked
    - Error messages safe
    - Rate limits enforced

- [ ] **[0.5h]** Performance testing
  - **Dependencies**: All implementation complete
  - **Assignee**: @qa-engineer
  - **Status**: Not Started
  - **Tasks**:
    - Measure generation time (10 mockups)
    - Check file sizes
    - Monitor API response times
    - Test concurrent generation (2x)
  - **Acceptance Criteria**:
    - Average time < 10s per mockup
    - File sizes < 5MB
    - No issues with 2 concurrent requests

- [ ] **[1h]** User acceptance testing
  - **Dependencies**: All implementation complete
  - **Assignee**: @tech-lead (with team)
  - **Status**: Not Started
  - **Tasks**:
    - Use in 1-2 real planning sessions
    - Gather quality feedback
    - Evaluate usefulness
    - Document any issues
  - **Acceptance Criteria**:
    - Used in real planning
    - Feedback collected
    - Quality acceptable (80%+ approval)

---

## Phase 4: Finalization ✅ Not Started

### Deployment

- [ ] **[0.5h]** Update environment configuration
  - **Dependencies**: All implementation complete
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Tasks**:
    - Add REPLICATE_API_TOKEN to production .env
    - Set optional config overrides if needed
    - Verify token permissions
  - **Acceptance Criteria**:
    - API token configured
    - Optional settings documented
    - Token tested in production

- [ ] **[0.5h]** Update project documentation
  - **Dependencies**: PF-005-17, PF-005-18, PF-005-19, PF-005-20
  - **Assignee**: @tech-writer
  - **Status**: Not Started
  - **Tasks**:
    - Add to CLAUDE.md features list
    - Update quick-start guide
    - Add to agent capabilities summary
    - Update project README if needed
  - **Acceptance Criteria**:
    - Documentation updated
    - Easy to find and understand
    - Examples included

- [ ] **[0.5h]** Create announcement and rollout plan
  - **Dependencies**: All validation complete
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Tasks**:
    - Draft announcement message
    - Plan gradual rollout (beta → general)
    - Set up usage monitoring
    - Prepare rollback plan
  - **Acceptance Criteria**:
    - Announcement drafted
    - Rollout plan documented
    - Monitoring in place

- [ ] **[0.5h]** Archive planning session
  - **Dependencies**: Feature deployed
  - **Assignee**: @tech-lead
  - **Status**: Not Started
  - **Tasks**:
    - Mark P-005 as completed in registry
    - Update PDR status to "Completed"
    - Update tech-analysis status to "Implemented"
    - Move to archived if needed
  - **Acceptance Criteria**:
    - Session marked complete
    - Statuses updated
    - Registry reflects completion

---

## Blockers & Risks

**Current Blockers**: None

**Potential Risks**:

1. **API Rate Limits**: Free tier may be insufficient
   - Mitigation: Monitor usage, budget for paid tier if needed

2. **Mockup Quality**: Generated mockups may not meet expectations
   - Mitigation: Iterate on prompts, gather feedback, allow regeneration

3. **Cost Overrun**: Unexpected high usage
   - Mitigation: Set up alerts, monthly budget cap

---

## Notes

**General Notes**:

- This is an experimental feature to enhance planning workflow
- Focus on developer experience and ease of use
- Quality of output depends on prompt engineering
- Consider this a "draft mockup" tool, not replacement for professional design

**Commit Policy (CRITICAL)**:

All commits MUST follow the **Atomic Commits Policy**:

- **ONLY** commit files modified for the specific PF-XXX task
- **NEVER** use `git add .` or `git add -A`
- **ALWAYS** use `git add <specific-file>` for task-related files
- Each PF-XXX subtask = One focused commit with `[PF-005-XX]` in message
- Reference: `.claude/docs/standards/atomic-commits.md`

**Example Commits:**

```bash
# PF-005-5: MockupGenerator class
git add .claude/agents/utils/mockup-generator.ts
git commit -m "feat(agents): implement MockupGenerator class [PF-005-5]"

# PF-005-10: Agent integration
git add .claude/agents/design/ux-ui-designer.md
git commit -m "feat(agents): extend UX/UI designer with mockup generation [PF-005-10]"
```

**Warning**: If `git status` shows unrelated files, commit ONLY task-related files.

**Technical Debt**:

- Synchronous API calls (may block agent briefly)
- No caching mechanism (regenerates every time)
- JSON metadata not queryable (fine for low volume)

**Future Enhancements**:

- Batch generation for multiple mockups
- Style consistency across session mockups
- Interactive regeneration with feedback
- Automated light/dark mode variants

---

**Last Updated**: 2025-10-31
**Next Review**: After Phase 2 completion
