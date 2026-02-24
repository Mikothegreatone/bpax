# BPAX 0.1-alpha Changelog

## 0.1-alpha (2026-02-24)

Initial alpha release of the BPAX specification.

### Core Structure
- `bpax_version` - Specification version identifier
- `id`, `name`, `description`, `version` - Process identification
- `author`, `created_at`, `updated_at` - Authorship metadata

### Blocks
- **metadata** - Domain, trigger, criticality, tags
- **roles** - Human, agent, system, external_agent types with autonomy levels
- **tools** - API, search, MCP tool references with auth and approval
- **context** - Inputs, memory, knowledge bases
- **steps** - agent_task, human_task, gateway, terminal types
- **cost** - Per-step, per-run, per-month budgets with attribution
- **security** - Data classification, access control, secrets, network
- **governance** - Lifecycle, compliance, audit, SLA
- **guardrails** - hard_block and soft_warn enforcement
- **error_handling** - Handlers, retry, escalation
- **observability** - Logging, metrics, tracing

### Framework Support
- LangGraph translation
- CrewAI translation (planned)
- OpenAI Agents SDK translation (planned)
- AutoGen translation (planned)

### Integrations
- MCP tool references via `mcp_server` field
- A2A external agent references via `external_agent_config`
