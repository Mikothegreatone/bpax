# BPAX - Business Process Agent eXchange

**BPAX** is an open standard for converting business processes into agentic workflows. It bridges the gap between how processes are documented and how AI agents execute them.

## The Problem

Today, converting a business process to an agentic workflow requires:
1. Documenting the process manually
2. Deciding which steps agents vs humans should own
3. Figuring out tools and APIs needed
4. Writing orchestration code from scratch
5. Defining failure handling, escalation, and human-in-loop triggers
6. Rebuilding everything for each process

**There is no intermediate representation.** You go from human knowledge directly to code.

## The Solution

BPAX is that intermediate representation. It's a JSON-based format that captures everything an agent needs to execute a business process:

- **Roles**: Who participates (humans, agents, systems)
- **Tools**: What capabilities agents can use (with MCP integration)
- **Steps**: The workflow with agent tasks, human tasks, gateways, and terminals
- **Guardrails**: Safety constraints and limits
- **Cost**: Budget tracking and attribution
- **Security**: Access control and data classification
- **Governance**: Lifecycle, compliance, and audit

## Ecosystem Fit

BPAX complements existing standards:
- **MCP** (Anthropic): Agent ↔ Tool connections
- **A2A** (Google/Linux Foundation): Agent ↔ Agent communication
- **BPAX**: Business Process → Agent Workflow definition

## Quick Start

```bash
# Install the CLI
npm install -g @bpax/cli

# Validate a BPAX document
bpax validate workflow.bpax.json

# Generate LangGraph code
bpax generate --framework langgraph workflow.bpax.json

# Estimate LLM costs
bpax estimate-cost workflow.bpax.json
```

## Example

```json
{
  "bpax_version": "0.1-alpha",
  "id": "lead-qualification",
  "name": "Lead Qualification Workflow",
  "metadata": {
    "domain": "sales",
    "trigger": { "type": "event", "config": { "event_type": "new_lead_created" } }
  },
  "roles": [
    {
      "id": "role_researcher",
      "type": "agent",
      "name": "Research Agent",
      "agent_config": { "autonomy_level": "supervised" }
    },
    {
      "id": "role_sales_rep",
      "type": "human",
      "name": "Sales Representative"
    }
  ],
  "steps": [
    {
      "id": "step_research",
      "name": "Research Prospect",
      "type": "agent_task",
      "assigned_to": "role_researcher",
      "instructions": "Research the prospect company and contact...",
      "on_success": "step_score"
    },
    {
      "id": "step_score",
      "name": "Score ICP Fit",
      "type": "agent_task",
      "assigned_to": "role_researcher",
      "instructions": "Score the prospect 1-10 for ICP fit...",
      "on_success": "gateway_score"
    },
    {
      "id": "gateway_score",
      "name": "Score Decision",
      "type": "gateway",
      "conditions": [
        { "condition": "output_score.value >= 7", "next_step": "step_human_review" },
        { "condition": "output_score.value >= 4", "next_step": "step_outreach" },
        { "condition": "output_score.value < 4", "next_step": "step_disqualify" }
      ]
    },
    {
      "id": "step_human_review",
      "name": "Human Review",
      "type": "human_task",
      "assigned_to": "role_sales_rep",
      "interface": { "type": "slack", "channel": "#sales-queue" },
      "on_success": "step_outreach"
    },
    {
      "id": "step_outreach",
      "name": "Draft Outreach",
      "type": "agent_task",
      "assigned_to": "role_researcher",
      "instructions": "Draft a personalized outreach email...",
      "on_success": "step_complete"
    },
    {
      "id": "step_disqualify",
      "name": "Disqualify",
      "type": "agent_task",
      "assigned_to": "role_researcher",
      "instructions": "Log as disqualified in CRM...",
      "on_success": "step_complete"
    },
    {
      "id": "step_complete",
      "name": "Complete",
      "type": "terminal"
    }
  ]
}
```

## Supported Frameworks

BPAX translates to:
- **LangGraph** - Graph-based orchestration
- **CrewAI** - Role-based agents with Flows
- **OpenAI Agents SDK** - Handoff patterns
- **AutoGen** - Conversation-based agents

## Documentation

- [Specification](./spec/0.1-alpha/bpax.schema.json) - JSON Schema
- [Examples](./examples) - Sample workflows
- [CLI Reference](./cli) - Command-line tool

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

Apache License 2.0 - See [LICENSE](./LICENSE)
