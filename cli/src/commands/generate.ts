/**
 * Generate Command
 *
 * Generates framework-specific code from BPAX documents.
 */

import { Command } from 'commander';
import { parseFile, validate, buildGraph } from '@bpax/sdk';
import chalk from 'chalk';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';

type Framework = 'langgraph' | 'crewai' | 'openai' | 'autogen';
type Language = 'python' | 'typescript';

export const generateCommand = new Command('generate')
  .description('Generate framework-specific code from a BPAX document')
  .argument('<file>', 'BPAX file to generate from')
  .requiredOption('-f, --framework <framework>', 'Target framework: langgraph, crewai, openai, autogen')
  .option('-o, --output <dir>', 'Output directory (default: ./generated)')
  .option('-l, --language <lang>', 'Output language: python, typescript', 'python')
  .option('--dry-run', 'Show what would be generated without writing files')
  .action(
    async (
      file: string,
      options: { framework: Framework; output?: string; language: Language; dryRun?: boolean }
    ) => {
      try {
        // Parse and validate
        const parseResult = await parseFile(file);
        if (!parseResult.success) {
          console.error(chalk.red('Parse Error:'));
          for (const error of parseResult.errors) {
            console.error(chalk.red(`  ${error.message}`));
          }
          process.exit(1);
        }

        const validation = validate(parseResult.document);
        if (!validation.valid) {
          console.error(chalk.red('Validation Error:'));
          for (const error of validation.errors) {
            console.error(chalk.red(`  ${error.message}`));
          }
          process.exit(1);
        }

        const document = parseResult.document;
        const graph = buildGraph(document);

        // Determine output directory
        const outputDir = options.output || './generated';
        const processName = document.id.replace(/-/g, '_');

        console.log(chalk.blue(`Generating ${options.framework} code for '${document.name}'...`));
        console.log(chalk.gray(`  Process ID: ${document.id}`));
        console.log(chalk.gray(`  Steps: ${document.steps.length}`));
        console.log(chalk.gray(`  Roles: ${document.roles?.length || 0}`));
        console.log(chalk.gray(`  Tools: ${document.tools?.length || 0}`));

        // Generate based on framework
        let files: Array<{ path: string; content: string }> = [];

        switch (options.framework) {
          case 'langgraph':
            files = generateLangGraph(document, graph, processName, options.language);
            break;
          case 'crewai':
            files = generateCrewAI(document, graph, processName);
            break;
          case 'openai':
            files = generateOpenAI(document, graph, processName);
            break;
          case 'autogen':
            files = generateAutoGen(document, graph, processName);
            break;
          default:
            console.error(chalk.red(`Unknown framework: ${options.framework}`));
            process.exit(1);
        }

        // Output
        if (options.dryRun) {
          console.log(chalk.yellow('\nDry run - files that would be generated:\n'));
          for (const f of files) {
            console.log(chalk.cyan(`--- ${f.path} ---`));
            console.log(f.content);
            console.log();
          }
        } else {
          await mkdir(outputDir, { recursive: true });
          for (const f of files) {
            const fullPath = join(outputDir, f.path);
            await mkdir(dirname(fullPath), { recursive: true });
            await writeFile(fullPath, f.content, 'utf-8');
            console.log(chalk.green(`  ✓ ${fullPath}`));
          }
          console.log(chalk.green(`\n✓ Generated ${files.length} file(s) in ${outputDir}`));
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    }
  );

// ============================================================================
// Framework Generators
// ============================================================================

function generateLangGraph(
  document: any,
  graph: any,
  processName: string,
  language: Language
): Array<{ path: string; content: string }> {
  if (language === 'typescript') {
    return generateLangGraphTS(document, graph, processName);
  }
  return generateLangGraphPython(document, graph, processName);
}

function generateLangGraphPython(
  document: any,
  graph: any,
  processName: string
): Array<{ path: string; content: string }> {
  const imports = `"""
${document.name}

Generated from BPAX document: ${document.id}
Framework: LangGraph
"""

from typing import TypedDict, Optional, List, Annotated
from operator import add
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
`;

  // Generate state class
  const stateFields: string[] = [];
  for (const input of document.context?.inputs || []) {
    const pyType = mapBpaxTypeToPython(input.type);
    stateFields.push(`    ${input.id}: ${input.required ? pyType : `Optional[${pyType}]`}`);
  }
  for (const step of document.steps) {
    if (step.output) {
      stateFields.push(`    ${step.output.id}: Optional[dict]`);
    }
  }
  stateFields.push(`    current_step: str`);
  stateFields.push(`    error_state: Optional[str]`);

  const stateClass = `
class ${toPascalCase(processName)}State(TypedDict):
${stateFields.join('\n') || '    pass'}
`;

  // Generate node functions
  const nodeFunctions: string[] = [];
  for (const step of document.steps) {
    if (step.type === 'agent_task') {
      nodeFunctions.push(generateAgentNodePython(step, processName));
    } else if (step.type === 'human_task') {
      nodeFunctions.push(generateHumanNodePython(step, processName));
    } else if (step.type === 'terminal') {
      nodeFunctions.push(generateTerminalNodePython(step, processName));
    }
  }

  // Generate routing functions for gateways
  const routingFunctions: string[] = [];
  for (const step of document.steps) {
    if (step.type === 'gateway') {
      routingFunctions.push(generateGatewayRouterPython(step, processName));
    }
  }

  // Generate graph builder
  const graphBuilder = generateGraphBuilderPython(document, graph, processName);

  // Generate main
  const mainCode = `
if __name__ == "__main__":
    # Example usage
    graph = build_${processName}_graph()

    # Run with sample inputs
    initial_state = {
        "current_step": "${graph.entryPoints[0] || 'start'}",
        "error_state": None,
    }

    result = graph.invoke(initial_state)
    print("Final state:", result)
`;

  const content = [
    imports,
    stateClass,
    ...nodeFunctions,
    ...routingFunctions,
    graphBuilder,
    mainCode,
  ].join('\n');

  return [
    { path: `${processName}.py`, content },
    { path: 'requirements.txt', content: 'langgraph>=0.2.0\nlangchain-core>=0.2.0\n' },
  ];
}

function generateAgentNodePython(step: any, processName: string): string {
  const funcName = step.id.replace(/-/g, '_');
  const instructions = step.instructions?.replace(/"/g, '\\"').replace(/\n/g, '\\n') || '';

  return `
def ${funcName}(state: ${toPascalCase(processName)}State) -> dict:
    """
    ${step.name}
    ${step.description || ''}
    """
    # Instructions: ${instructions}

    # TODO: Implement agent logic
    # - Use LLM to process instructions
    # - Access tools: ${(step.tools_available || []).join(', ') || 'none'}
    # - Return output matching schema

    return {
        "${step.output?.id || 'output'}": {"status": "completed"},
        "current_step": "${step.on_success || 'END'}",
    }
`;
}

function generateHumanNodePython(step: any, processName: string): string {
  const funcName = step.id.replace(/-/g, '_');

  return `
def ${funcName}(state: ${toPascalCase(processName)}State) -> dict:
    """
    ${step.name} (Human Task)
    ${step.description || ''}
    """
    from langgraph.types import interrupt

    # Build payload for human review
    payload = {
        "step_id": "${step.id}",
        "step_name": "${step.name}",
        # Add inputs to show human
    }

    # This pauses execution until human responds
    human_response = interrupt(payload)

    # Process human response
    approved = human_response.get("approved", True)

    return {
        "${step.output?.id || 'output'}": human_response,
        "current_step": "${step.on_success}" if approved else "${step.on_rejection || step.on_failure || 'END'}",
    }
`;
}

function generateTerminalNodePython(step: any, processName: string): string {
  const funcName = step.id.replace(/-/g, '_');

  return `
def ${funcName}(state: ${toPascalCase(processName)}State) -> dict:
    """
    ${step.name} (Terminal)
    """
    return state
`;
}

function generateGatewayRouterPython(step: any, processName: string): string {
  const funcName = `route_${step.id.replace(/-/g, '_')}`;
  const conditions: string[] = [];

  for (const cond of step.conditions || []) {
    // Convert BPAX condition to Python
    const pyCondition = cond.condition
      .replace(/\./g, '"]["')
      .replace(/^([a-z_]+)/, 'state["$1"]');
    conditions.push(`    if ${pyCondition}:\n        return "${cond.next_step}"`);
  }

  return `
def ${funcName}(state: ${toPascalCase(processName)}State) -> str:
    """
    ${step.name} (Gateway Router)
    """
${conditions.join('\n')}
    return "${step.default_step || 'END'}"
`;
}

function generateGraphBuilderPython(document: any, graph: any, processName: string): string {
  const addNodes: string[] = [];
  const addEdges: string[] = [];

  for (const step of document.steps) {
    const funcName = step.id.replace(/-/g, '_');
    addNodes.push(`    graph.add_node("${step.id}", ${funcName})`);
  }

  for (const step of document.steps) {
    if (step.type === 'gateway') {
      const routerFunc = `route_${step.id.replace(/-/g, '_')}`;
      const targets: string[] = [];
      for (const cond of step.conditions || []) {
        targets.push(`"${cond.next_step}": "${cond.next_step}"`);
      }
      if (step.default_step) {
        targets.push(`"${step.default_step}": "${step.default_step}"`);
      }
      addEdges.push(
        `    graph.add_conditional_edges("${step.id}", ${routerFunc}, {${targets.join(', ')}})`
      );
    } else if (step.type === 'terminal') {
      addEdges.push(`    graph.add_edge("${step.id}", END)`);
    } else if (step.on_success) {
      addEdges.push(`    graph.add_edge("${step.id}", "${step.on_success}")`);
    }
  }

  const entryPoint = graph.entryPoints[0] || document.steps[0]?.id || 'start';

  return `
def build_${processName}_graph():
    """Build the LangGraph workflow."""
    graph = StateGraph(${toPascalCase(processName)}State)

    # Add nodes
${addNodes.join('\n')}

    # Add edges
${addEdges.join('\n')}

    # Set entry point
    graph.set_entry_point("${entryPoint}")

    # Compile with checkpointer for persistence
    checkpointer = MemorySaver()
    return graph.compile(checkpointer=checkpointer)
`;
}

function generateLangGraphTS(
  document: any,
  graph: any,
  processName: string
): Array<{ path: string; content: string }> {
  // TypeScript version - simplified for now
  const content = `/**
 * ${document.name}
 *
 * Generated from BPAX document: ${document.id}
 * Framework: LangGraph (TypeScript)
 */

// TODO: TypeScript LangGraph implementation
// See Python version for reference

export {};
`;

  return [{ path: `${processName}.ts`, content }];
}

function generateCrewAI(
  document: any,
  graph: any,
  processName: string
): Array<{ path: string; content: string }> {
  const content = `"""
${document.name}

Generated from BPAX document: ${document.id}
Framework: CrewAI
"""

from crewai import Agent, Task, Crew
from crewai.flow.flow import Flow, listen, start, router
from pydantic import BaseModel
from typing import Optional

# TODO: Implement CrewAI flow
# See BPAX translator documentation for full implementation

class ${toPascalCase(processName)}Flow(Flow):
    pass

if __name__ == "__main__":
    flow = ${toPascalCase(processName)}Flow()
    # flow.kickoff()
`;

  return [
    { path: `${processName}_crew.py`, content },
    { path: 'requirements.txt', content: 'crewai>=0.55.0\n' },
  ];
}

function generateOpenAI(
  document: any,
  graph: any,
  processName: string
): Array<{ path: string; content: string }> {
  const content = `"""
${document.name}

Generated from BPAX document: ${document.id}
Framework: OpenAI Agents SDK
"""

from agents import Agent, handoff, function_tool, Runner

# TODO: Implement OpenAI Agents SDK agents
# See BPAX translator documentation for full implementation

if __name__ == "__main__":
    pass
`;

  return [
    { path: `${processName}_openai.py`, content },
    { path: 'requirements.txt', content: 'openai-agents>=0.1.0\n' },
  ];
}

function generateAutoGen(
  document: any,
  graph: any,
  processName: string
): Array<{ path: string; content: string }> {
  const content = `"""
${document.name}

Generated from BPAX document: ${document.id}
Framework: AutoGen
"""

import autogen
from autogen import AssistantAgent, UserProxyAgent, GroupChat, GroupChatManager

# TODO: Implement AutoGen agents
# See BPAX translator documentation for full implementation

if __name__ == "__main__":
    pass
`;

  return [
    { path: `${processName}_autogen.py`, content },
    { path: 'requirements.txt', content: 'pyautogen>=0.2.0\n' },
  ];
}

// ============================================================================
// Utilities
// ============================================================================

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function mapBpaxTypeToPython(type: string): string {
  switch (type) {
    case 'string':
      return 'str';
    case 'integer':
      return 'int';
    case 'number':
      return 'float';
    case 'boolean':
      return 'bool';
    case 'object':
      return 'dict';
    case 'array':
      return 'list';
    default:
      return 'any';
  }
}
