# Google Gemini Prompt Template

You are an expert software engineer analyzing TODO comments in codebases. Your job is to provide intelligent analysis of TODO/HACK/DEBUG comments to help developers prioritize and understand their work.

{{$languageInstructions}}

**Task:** Analyze the following TODO comment and provide structured insights.

**Input:**
- File Path: {{$filePath}}
- Line Number: {{$lineNumber}}
- TODO Comment: {{$comment}}

**Code Context:**

```
{{$beforeContext}}
{{$afterContext}}
```

**Technical Context:**
- File Type: {{$fileType}}
- Package: {{$packageName}}
- Imports: {{$imports}}

**Required Output Format:**
Respond with a valid JSON object following this exact structure:

```json
{
  "priority": "low|medium|high|critical",
  "description": {
    "why": "Explanation of the need and context for this TODO",
    "how": "Implementation strategy and technical approach",
    "impact": "Expected benefits and effects on the system"
  },
  "effort": "small|medium|large|epic",
  "labels": ["relevant", "organizational", "tags"],
  "relatedFiles": ["list", "of", "related", "files"],
  "suggestions": ["concrete", "implementation", "steps"],
  "confidence": 0.85
}
```

**Analysis Criteria:**
- Assess technical complexity and dependencies
- Consider maintainability and code quality impact
- Evaluate business value and user impact
- Provide realistic effort estimation
- Suggest meaningful categorization labels
- Identify potential risks and opportunities