---
name: web-search
description: "Search the web to verify and enrich entity names extracted from documents and images. Use when a person name, place name, organization, or term is uncertain, ambiguous, or needs real-time verification."
user-invocable: false
metadata: { "openclaw": { "emoji": "🔍", "requires": { "env": ["ANTHROPIC_API_KEY"] } } }
---

# Skill: web-search

Use Claude's built-in `web_search` tool to verify and enrich named entities extracted during metadata analysis.

## When to use

- An extracted person name is ambiguous or incomplete
- A place name inferred from image content needs confirmation
- An organization name is unfamiliar or could refer to multiple entities
- A technical term or proper noun needs a brief definition for context

## How to use

Declare the tool in your API call:

```python
tools = [
    {
        "type": "web_search_20260209",
        "name": "web_search",
        "max_uses": 3,
    }
]
```

## Prompt structure

```
Verify the following entity extracted from a document:

Entity: {entity_name}
Context: {why it was extracted / surrounding text}

Search for this entity and return:
1. What this entity refers to (person / place / organization)
2. Any corrections to spelling or full name
3. Brief description (1-2 sentences)
4. Confidence that this matches the entity in the document (high / medium / low)
```

## Output format

```json
{
  "entity_original": "original extracted text",
  "entity_verified": "corrected or confirmed name",
  "type": "person | place | organization | other",
  "description": "Brief description of the entity",
  "confidence": "high | medium | low"
}
```

## Notes

- Keep searches targeted: search for the specific entity, not broad topics
- Limit to 3 searches per extraction call to control token usage
- If confidence is low after searching, keep the original value with a lower confidence score in the metadata
