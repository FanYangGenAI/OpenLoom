---
name: ocr
description: "Extract text from images using OCR. Use when an image contains text that needs to be read — such as scanned documents, screenshots, signs, or handwritten notes."
---

# OCR Skill

Performs Optical Character Recognition (OCR) on images using DeepSeek's vision model. Supports two modes: **online** (DeepSeek API) and **local** (Ollama), switchable via the `--provider` flag or the `OCR_PROVIDER` environment variable.

## When to use

- An image contains readable text (scanned documents, screenshots, whiteboards, signs)
- A photo contains a visible document, letter, or certificate
- Handwritten notes need to be digitized

## Usage

```bash
node {baseDir}/scripts/recognize.js "<image-path>" [--provider=online|local]
```

Examples:
```bash
# Use online DeepSeek API (default)
node {baseDir}/scripts/recognize.js "/path/to/scan.jpg"

# Use local Ollama deployment
node {baseDir}/scripts/recognize.js "/path/to/scan.jpg" --provider=local
```

## Provider configuration

### Online (DeepSeek API)
Requires environment variable: `DEEPSEEK_API_KEY`

### Local (Ollama)
Requires Ollama running locally with the DeepSeek VL model:
```bash
ollama pull deepseek-vl2:7b
ollama serve
```
Default base URL: `http://localhost:11434` (override with `OLLAMA_BASE_URL`)

## Output format

Returns JSON to stdout:
```json
{
  "provider": "online",
  "text": "Extracted text content from the image...",
  "confidence": "high"
}
```

Returns `{ "text": "" }` if no text is detected in the image.
