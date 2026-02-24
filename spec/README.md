# BPAX Specification

This directory contains the BPAX (Business Process Agent eXchange) specification.

## Versions

| Version | Status | Release Date |
|---------|--------|--------------|
| [0.1-alpha](./0.1-alpha/) | Current | 2026-02-24 |

## Versioning Policy

BPAX follows semantic versioning with stability guarantees:

| Version Pattern | Stability |
|-----------------|-----------|
| `0.x-alpha` | Breaking changes allowed between any versions |
| `0.x-beta` | Breaking changes only between minor versions |
| `0.x` | Breaking changes only between minor versions |
| `1.x+` | Backwards compatible; breaking changes require major bump |

## Directory Structure

```
spec/
├── 0.1-alpha/
│   ├── bpax.schema.json    # JSON Schema (source of truth)
│   ├── CHANGELOG.md        # Version changes
│   └── MIGRATION.md        # Migration guide (when applicable)
├── 0.2-alpha/              # Future version
│   └── ...
└── README.md               # This file
```

## Using the Schema

The schema is available at:
- Local: `spec/{version}/bpax.schema.json`
- Published: `https://bpax.io/schema/{version}/bpax.schema.json`

### Validation

```bash
# Using AJV CLI
npx ajv validate -s spec/0.1-alpha/bpax.schema.json -d your-workflow.json --spec=draft2020

# Using BPAX CLI
bpax validate your-workflow.json
```

### Referencing in Documents

```json
{
  "$schema": "https://bpax.io/schema/0.1-alpha/bpax.schema.json",
  "bpax_version": "0.1-alpha",
  "id": "my-workflow",
  ...
}
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on proposing spec changes.
