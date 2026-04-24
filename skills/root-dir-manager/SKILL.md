---
name: root-dir-manager
description: "Manage the default user data root directory for OpenLoom. Use when setup or CLI needs to show, set, or clear the current root path."
---

# Root Directory Manager Skill

This skill provides a stable single-root interface for MVP.

## Responsibilities

- Show current default root
- Set default root path
- Clear default root
- Keep data synced with `.openloom/config/user-settings.json`

## Usage

```bash
node {baseDir}/scripts/run.js show --openloom "<openloom-dir>"
node {baseDir}/scripts/run.js set "<root-path>" --openloom "<openloom-dir>"
node {baseDir}/scripts/run.js clear --openloom "<openloom-dir>"
```

## Output format

Returns JSON to stdout:

```json
{
  "status": "ok",
  "action": "set",
  "default_root": "/path/to/data"
}
```
