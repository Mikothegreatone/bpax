/**
 * Cost Estimator Utility
 *
 * Estimates LLM costs for running a BPAX workflow.
 */

import type { BPAXDocument, AgentTaskStep } from '../types/index.js';

export interface StepCostEstimate {
  stepId: string;
  stepName: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  model: string;
}

export interface CostEstimate {
  totalEstimatedCostUsd: number;
  totalEstimatedInputTokens: number;
  totalEstimatedOutputTokens: number;
  stepEstimates: StepCostEstimate[];
  model: string;
  assumptions: string[];
}

// Model pricing (per 1M tokens) - as of early 2026
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'claude-haiku-3-20250307': { input: 0.25, output: 1.25 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  default: { input: 3.0, output: 15.0 },
};

// Rough token estimation constants
const AVG_CHARS_PER_TOKEN = 4;
const SYSTEM_PROMPT_OVERHEAD_TOKENS = 500;
const TOOL_CALL_OVERHEAD_TOKENS = 200;

/**
 * Estimate costs for running a BPAX workflow.
 *
 * @param document - BPAX document
 * @param model - Model to use for estimation
 * @param runs - Number of runs to estimate (default: 1)
 * @returns CostEstimate
 */
export function estimateCost(
  document: BPAXDocument,
  model: string = 'claude-sonnet-4-20250514',
  runs: number = 1
): CostEstimate {
  const stepEstimates: StepCostEstimate[] = [];
  const assumptions: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Get pricing for model
  const pricing = MODEL_PRICING[model] || MODEL_PRICING.default;
  if (!MODEL_PRICING[model]) {
    assumptions.push(`Using default pricing for unknown model '${model}'`);
  }

  // Estimate each agent task step
  for (const step of document.steps) {
    if (step.type !== 'agent_task') continue;

    const agentStep = step as AgentTaskStep;

    // Estimate input tokens
    let inputTokens = SYSTEM_PROMPT_OVERHEAD_TOKENS;

    // Add instruction length
    if (agentStep.instructions) {
      inputTokens += Math.ceil(agentStep.instructions.length / AVG_CHARS_PER_TOKEN);
    }

    // Add tool overhead if tools are used
    if (agentStep.tools_available && agentStep.tools_available.length > 0) {
      inputTokens += TOOL_CALL_OVERHEAD_TOKENS * agentStep.tools_available.length;
    }

    // Add context from knowledge bases (rough estimate)
    if (agentStep.knowledge_bases && agentStep.knowledge_bases.length > 0) {
      inputTokens += 1000 * agentStep.knowledge_bases.length; // Assume ~1000 tokens per KB query
      assumptions.push('Assuming ~1000 tokens per knowledge base retrieval');
    }

    // Estimate output tokens based on output schema complexity
    let outputTokens = 500; // Default
    if (agentStep.output?.schema) {
      const schemaComplexity = JSON.stringify(agentStep.output.schema).length;
      outputTokens = Math.max(500, Math.ceil(schemaComplexity / 2));
    }

    // Calculate cost
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    const stepCost = inputCost + outputCost;

    stepEstimates.push({
      stepId: agentStep.id,
      stepName: agentStep.name,
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      estimatedCostUsd: stepCost,
      model,
    });

    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;
  }

  // Calculate total cost
  const totalCost =
    (totalInputTokens / 1_000_000) * pricing.input + (totalOutputTokens / 1_000_000) * pricing.output;

  // Add standard assumptions
  assumptions.unshift(`Estimated using ${AVG_CHARS_PER_TOKEN} chars per token`);
  assumptions.push(`System prompt overhead: ${SYSTEM_PROMPT_OVERHEAD_TOKENS} tokens per step`);
  assumptions.push('Actual costs may vary based on context, retries, and model behavior');

  return {
    totalEstimatedCostUsd: totalCost * runs,
    totalEstimatedInputTokens: totalInputTokens * runs,
    totalEstimatedOutputTokens: totalOutputTokens * runs,
    stepEstimates,
    model,
    assumptions,
  };
}
