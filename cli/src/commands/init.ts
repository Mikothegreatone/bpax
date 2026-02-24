/**
 * Init Command
 *
 * Creates a new BPAX document from a template.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

type Template = 'minimal' | 'human-in-loop' | 'enterprise';

const TEMPLATES: Record<Template, object> = {
  minimal: {
    bpax_version: '0.1-alpha',
    id: 'my-workflow',
    name: 'My Workflow',
    description: 'A new BPAX workflow',
    version: '1.0.0',
    metadata: {
      domain: 'custom',
      trigger: { type: 'manual' },
      criticality: 'medium',
      tags: [],
    },
    roles: [
      {
        id: 'role_agent',
        type: 'agent',
        name: 'Main Agent',
        agent_config: {
          autonomy_level: 'supervised',
        },
      },
    ],
    steps: [
      {
        id: 'step_main',
        name: 'Main Step',
        type: 'agent_task',
        assigned_to: 'role_agent',
        instructions: 'TODO: Add instructions',
        on_success: 'step_complete',
      },
      {
        id: 'step_complete',
        name: 'Complete',
        type: 'terminal',
      },
    ],
  },
  'human-in-loop': {
    bpax_version: '0.1-alpha',
    id: 'my-workflow',
    name: 'My Workflow with Human Review',
    description: 'A workflow with human-in-loop review',
    version: '1.0.0',
    metadata: {
      domain: 'custom',
      trigger: { type: 'manual' },
      criticality: 'medium',
    },
    roles: [
      {
        id: 'role_agent',
        type: 'agent',
        name: 'Processing Agent',
        agent_config: { autonomy_level: 'supervised' },
      },
      {
        id: 'role_reviewer',
        type: 'human',
        name: 'Human Reviewer',
      },
    ],
    steps: [
      {
        id: 'step_process',
        name: 'Process',
        type: 'agent_task',
        assigned_to: 'role_agent',
        instructions: 'TODO: Add processing instructions',
        on_success: 'step_review',
      },
      {
        id: 'step_review',
        name: 'Human Review',
        type: 'human_task',
        assigned_to: 'role_reviewer',
        interface: {
          type: 'slack',
          channel: '#reviews',
          message_template: 'Please review the results',
        },
        timeout_minutes: 1440,
        on_success: 'step_complete',
        on_rejection: 'step_process',
      },
      {
        id: 'step_complete',
        name: 'Complete',
        type: 'terminal',
      },
    ],
  },
  enterprise: {
    bpax_version: '0.1-alpha',
    id: 'my-workflow',
    name: 'Enterprise Workflow',
    description: 'A workflow with full enterprise configuration',
    version: '1.0.0',
    metadata: {
      domain: 'operations',
      trigger: { type: 'api', config: { api_endpoint: '/trigger' } },
      criticality: 'high',
      tags: ['enterprise'],
    },
    roles: [
      {
        id: 'role_agent',
        type: 'agent',
        name: 'Main Agent',
        agent_config: { autonomy_level: 'human_in_loop' },
      },
      {
        id: 'role_reviewer',
        type: 'human',
        name: 'Reviewer',
      },
    ],
    tools: [
      {
        id: 'tool_api',
        name: 'API Tool',
        type: 'api',
        auth: { method: 'api_key', secret_ref: 'API_KEY' },
        assigned_to: ['role_agent'],
      },
    ],
    context: {
      inputs: [
        {
          id: 'input_data',
          name: 'Input Data',
          type: 'object',
          required: true,
        },
      ],
    },
    steps: [
      {
        id: 'step_main',
        name: 'Main Step',
        type: 'agent_task',
        assigned_to: 'role_agent',
        instructions: 'TODO: Add instructions',
        tools_available: ['tool_api'],
        on_success: 'step_complete',
      },
      {
        id: 'step_complete',
        name: 'Complete',
        type: 'terminal',
      },
    ],
    cost: {
      budget: {
        per_run: { max_usd: 1.0, on_overrun: 'block' },
      },
      attribution: {
        environment: 'production',
      },
    },
    security: {
      data_classification: {
        level: 'internal',
        contains_pii: false,
      },
      secrets: {
        provider: 'env',
        references: {
          API_KEY: 'MY_API_KEY',
        },
      },
    },
    governance: {
      lifecycle: {
        status: 'draft',
        approval_required_to_deploy: true,
      },
    },
    guardrails: [
      {
        id: 'guard_cost',
        description: 'Cost limit',
        enforcement: 'hard_block',
        type: 'cost_cap',
        config: { max_cost_usd: 1.0 },
      },
    ],
    observability: {
      logging: { level: 'step', destination: 'stdout' },
    },
  },
};

export const initCommand = new Command('init')
  .description('Create a new BPAX document')
  .option('-t, --template <template>', 'Template: minimal, human-in-loop, enterprise', 'minimal')
  .option('-n, --name <name>', 'Process name')
  .option('-o, --output <dir>', 'Output directory', '.')
  .action(async (options: { template: Template; name?: string; output: string }) => {
    try {
      const template = TEMPLATES[options.template];
      if (!template) {
        console.error(chalk.red(`Unknown template: ${options.template}`));
        console.log(chalk.gray('Available templates: minimal, human-in-loop, enterprise'));
        process.exit(1);
      }

      // Clone and customize template
      const doc = JSON.parse(JSON.stringify(template));
      if (options.name) {
        doc.name = options.name;
        doc.id = options.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }

      // Write file
      await mkdir(options.output, { recursive: true });
      const filename = `${doc.id}.bpax.json`;
      const filepath = join(options.output, filename);
      await writeFile(filepath, JSON.stringify(doc, null, 2), 'utf-8');

      console.log(chalk.green(`✓ Created ${filepath}`));
      console.log(chalk.gray('\nNext steps:'));
      console.log(chalk.gray(`  1. Edit ${filename} to define your workflow`));
      console.log(chalk.gray(`  2. Run: bpax validate ${filename}`));
      console.log(chalk.gray(`  3. Run: bpax generate --framework langgraph ${filename}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });
