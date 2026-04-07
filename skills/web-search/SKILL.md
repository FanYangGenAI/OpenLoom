---
name: web-search
description: "Search the web to verify and enrich entity names found during metadata extraction. Use when an extracted person name, place name, or organization name is uncertain, ambiguous, or needs additional context."
---

# Web Search Skill

This skill performs targeted web searches to verify and enrich entity information extracted from documents and images. It uses the DuckDuckGo Instant Answer API — no API key required.

## When to use

- An extracted person name is ambiguous or incomplete (e.g. an abbreviation or nickname)
- A place name inferred from image content needs verification
- An organization name is unfamiliar or could refer to multiple entities
- A technical term or proper noun needs a brief definition for context

## Usage

```bash
node {baseDir}/scripts/search.js "<query>" [--num=3]
```

Examples:
```bash
node {baseDir}/scripts/search.js "迪士尼乐园 上海"
node {baseDir}/scripts/search.js "Anthropic AI company" --num=2
```

## Output format

Returns JSON to stdout:
```json
{
  "query": "original search query",
  "abstract": "Brief summary from DuckDuckGo (if available)",
  "abstract_url": "https://source-url",
  "results": [
    {
      "title": "Result title",
      "snippet": "Brief description"
    }
  ]
}
```

## Important notes

- Use concise, targeted queries focused on the specific entity
- Limit to 1–3 results; this is for quick entity verification, not deep research
- If results are inconclusive, keep the original extracted value with a lower confidence score
- Results are in the language of the query; use the same language as the entity being verified
