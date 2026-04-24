---
name: bootstrap-cold-start
description: "Run first-time onboarding for OpenLoom. Use when setup needs to capture user naming and communication preferences, check environment readiness, and initialize local memory/config files."
---

# Bootstrap Cold Start Skill

This skill orchestrates first-time onboarding for the agent-user relationship.

## Responsibilities

- Ask onboarding questions (user name, agent name, tone, format preference)
- Allow skip answers while still producing a usable initialized state
- Check environment readiness for OCR modes
- Write long-term memory into `.openloom/agent/lessons.md`
- Write setup state into `.openloom/config/user-settings.json`

## Usage

```bash
node {baseDir}/scripts/run.js --openloom "<openloom-dir>" [--root "<root-path>"] [--non-interactive]
```

## Output format

Returns JSON to stdout:

```json
{
  "status": "initialized",
  "openloom_dir": "/path/to/.openloom",
  "lessons_path": "/path/to/.openloom/agent/lessons.md",
  "settings_path": "/path/to/.openloom/config/user-settings.json",
  "checks": {
    "deepseek_api_key": true,
    "ollama_env": false
  }
}
```
