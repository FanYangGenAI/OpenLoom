---
name: interactive-extract
description: "Guide users through interactive metadata extraction options. Use when extracting metadata via prompts instead of full manual CLI arguments."
---

# Interactive Extract Skill

This skill coordinates option prompts, then delegates extraction to existing pipelines.

## Responsibilities

- Prompt for OCR provider, face detection, and concurrency values
- Build resolved extract options from user answers
- Keep non-interactive extract behavior unchanged
- Return machine-readable options for CLI execution

## Usage

```bash
node {baseDir}/scripts/run.js --json
```

## Output format

Returns JSON to stdout:

```json
{
  "ocrProvider": "online",
  "skipFaceDetection": false,
  "textConcurrency": 5,
  "imageConcurrency": 3
}
```
