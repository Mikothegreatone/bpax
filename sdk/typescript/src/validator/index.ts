/**
 * BPAX Validator
 *
 * Validates BPAX documents against the JSON Schema and semantic rules.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { BPAXDocument, Step } from '../types/index.js';

// Import schema - in production this would be bundled
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

let schema: object;
try {
  schema = require('../../../../spec/0.1-alpha/bpax.schema.json');
} catch {
  // Fallback for when running from different locations
  schema = {};
}

export interface ValidationError {
  code: string;
  path: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  code: string;
  path: string;
  message: string;
  severity: 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// Initialize AJV with formats
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false,
});
addFormats(ajv);

// Compile schema
let validateFn: ReturnType<typeof ajv.compile> | null = null;
try {
  if (Object.keys(schema).length > 0) {
    validateFn = ajv.compile(schema);
  }
} catch (error) {
  console.warn('Failed to compile BPAX schema:', error);
}

/**
 * Validate a BPAX document against the JSON Schema.
 *
 * @param document - Raw JSON document (before type assertion)
 * @returns ValidationResult
 */
export function validateSchema(document: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!validateFn) {
    warnings.push({
      code: 'SCHEMA_NOT_LOADED',
      path: '',
      message: 'JSON Schema not loaded - schema validation skipped',
      severity: 'warning',
    });
    return { valid: true, errors, warnings };
  }

  const valid = validateFn(document);

  if (!valid && validateFn.errors) {
    for (const error of validateFn.errors) {
      const path = error.instancePath || '/';
      let code = 'SCHEMA_ERROR';

      // Map AJV keywords to codes
      switch (error.keyword) {
        case 'required':
          code = 'SCHEMA_REQUIRED';
          break;
        case 'enum':
          code = 'SCHEMA_ENUM';
          break;
        case 'type':
          code = 'SCHEMA_TYPE';
          break;
        case 'pattern':
          code = 'SCHEMA_PATTERN';
          break;
        case 'const':
          code = 'SCHEMA_CONST';
          break;
        case 'additionalProperties':
          code = 'SCHEMA_ADDITIONAL_PROPS';
          break;
        case 'oneOf':
        case 'anyOf':
          code = 'SCHEMA_UNION';
          break;
      }

      errors.push({
        code,
        path,
        message: error.message || 'Schema validation failed',
        severity: 'error',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate semantic rules that can't be expressed in JSON Schema.
 *
 * @param document - Typed BPAX document
 * @returns ValidationResult
 */
export function validateSemantic(document: BPAXDocument): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Collect all IDs for reference checking
  const roleIds = new Set(document.roles?.map((r) => r.id) ?? []);
  const toolIds = new Set(document.tools?.map((t) => t.id) ?? []);
  const stepIds = new Set(document.steps.map((s) => s.id));
  const inputIds = new Set(document.context?.inputs?.map((i) => i.id) ?? []);
  const kbIds = new Set(document.context?.knowledge_bases?.map((k) => k.id) ?? []);

  // Check step references
  for (let i = 0; i < document.steps.length; i++) {
    const step = document.steps[i];
    const basePath = `/steps/${i}`;

    // Check assigned_to references valid role
    if ('assigned_to' in step && step.assigned_to) {
      if (!roleIds.has(step.assigned_to)) {
        errors.push({
          code: 'SEMANTIC_INVALID_REF',
          path: `${basePath}/assigned_to`,
          message: `Role '${step.assigned_to}' not found in roles`,
          severity: 'error',
        });
      }
    }

    // Check tools_available references valid tools
    if ('tools_available' in step && step.tools_available) {
      for (const toolId of step.tools_available) {
        if (!toolIds.has(toolId)) {
          errors.push({
            code: 'SEMANTIC_INVALID_REF',
            path: `${basePath}/tools_available`,
            message: `Tool '${toolId}' not found in tools`,
            severity: 'error',
          });
        }
      }
    }

    // Check on_success/on_failure/on_timeout references valid steps
    const transitions = ['on_success', 'on_failure', 'on_timeout', 'on_rejection'] as const;
    for (const trans of transitions) {
      if (trans in step) {
        const targetId = (step as Record<string, unknown>)[trans] as string | undefined;
        if (targetId && !stepIds.has(targetId)) {
          errors.push({
            code: 'SEMANTIC_INVALID_REF',
            path: `${basePath}/${trans}`,
            message: `Step '${targetId}' not found in steps`,
            severity: 'error',
          });
        }
      }
    }

    // Check gateway conditions reference valid steps
    if (step.type === 'gateway') {
      for (let j = 0; j < step.conditions.length; j++) {
        const cond = step.conditions[j];
        if (!stepIds.has(cond.next_step)) {
          errors.push({
            code: 'SEMANTIC_INVALID_REF',
            path: `${basePath}/conditions/${j}/next_step`,
            message: `Step '${cond.next_step}' not found in steps`,
            severity: 'error',
          });
        }
      }

      if (step.default_step && !stepIds.has(step.default_step)) {
        errors.push({
          code: 'SEMANTIC_INVALID_REF',
          path: `${basePath}/default_step`,
          message: `Step '${step.default_step}' not found in steps`,
          severity: 'error',
        });
      }
    }
  }

  // Check for unreachable steps
  const reachableSteps = findReachableSteps(document.steps);
  for (const step of document.steps) {
    if (!reachableSteps.has(step.id)) {
      warnings.push({
        code: 'SEMANTIC_UNREACHABLE',
        path: `/steps`,
        message: `Step '${step.id}' is unreachable from the entry point`,
        severity: 'warning',
      });
    }
  }

  // Check for cycles (not necessarily an error, but worth warning)
  const cycles = findCycles(document.steps);
  if (cycles.length > 0) {
    for (const cycle of cycles) {
      warnings.push({
        code: 'SEMANTIC_CYCLE',
        path: '/steps',
        message: `Cycle detected: ${cycle.join(' -> ')}`,
        severity: 'warning',
      });
    }
  }

  // Check tool assignments reference valid roles
  for (let i = 0; i < (document.tools?.length ?? 0); i++) {
    const tool = document.tools![i];
    if (tool.assigned_to) {
      for (const roleId of tool.assigned_to) {
        if (!roleIds.has(roleId)) {
          errors.push({
            code: 'SEMANTIC_INVALID_REF',
            path: `/tools/${i}/assigned_to`,
            message: `Role '${roleId}' not found in roles`,
            severity: 'error',
          });
        }
      }
    }
  }

  // Check guardrail references
  for (let i = 0; i < (document.guardrails?.length ?? 0); i++) {
    const guard = document.guardrails![i];
    if (Array.isArray(guard.applies_to)) {
      for (const ref of guard.applies_to) {
        if (!roleIds.has(ref) && !stepIds.has(ref)) {
          errors.push({
            code: 'SEMANTIC_INVALID_REF',
            path: `/guardrails/${i}/applies_to`,
            message: `Reference '${ref}' not found in roles or steps`,
            severity: 'error',
          });
        }
      }
    }
  }

  // Warn if no terminal steps
  const hasTerminal = document.steps.some((s) => s.type === 'terminal');
  if (!hasTerminal) {
    warnings.push({
      code: 'SEMANTIC_NO_TERMINAL',
      path: '/steps',
      message: 'No terminal step defined - process may not have a clear end',
      severity: 'warning',
    });
  }

  // Warn if human tasks have no timeout
  for (let i = 0; i < document.steps.length; i++) {
    const step = document.steps[i];
    if (step.type === 'human_task' && !step.timeout_minutes) {
      warnings.push({
        code: 'SEMANTIC_NO_TIMEOUT',
        path: `/steps/${i}`,
        message: `Human task '${step.id}' has no timeout - may wait indefinitely`,
        severity: 'warning',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Full validation - schema + semantic.
 */
export function validate(document: unknown): ValidationResult {
  // First validate schema
  const schemaResult = validateSchema(document);
  if (!schemaResult.valid) {
    return schemaResult;
  }

  // Then validate semantics
  const semanticResult = validateSemantic(document as BPAXDocument);

  return {
    valid: schemaResult.valid && semanticResult.valid,
    errors: [...schemaResult.errors, ...semanticResult.errors],
    warnings: [...schemaResult.warnings, ...semanticResult.warnings],
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function findReachableSteps(steps: Step[]): Set<string> {
  const reachable = new Set<string>();
  const stepMap = new Map(steps.map((s) => [s.id, s]));

  // Find entry point (step with no incoming edges)
  const hasIncoming = new Set<string>();
  for (const step of steps) {
    const transitions = getOutgoingTransitions(step);
    for (const target of transitions) {
      hasIncoming.add(target);
    }
  }

  // Entry points are steps with no incoming edges
  const entryPoints = steps.filter((s) => !hasIncoming.has(s.id));

  // BFS from entry points
  const queue = entryPoints.map((s) => s.id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);

    const step = stepMap.get(id);
    if (!step) continue;

    const transitions = getOutgoingTransitions(step);
    for (const target of transitions) {
      if (!reachable.has(target)) {
        queue.push(target);
      }
    }
  }

  return reachable;
}

function getOutgoingTransitions(step: Step): string[] {
  const transitions: string[] = [];

  if ('on_success' in step && step.on_success) transitions.push(step.on_success);
  if ('on_failure' in step && step.on_failure) transitions.push(step.on_failure);
  if ('on_timeout' in step && step.on_timeout) transitions.push(step.on_timeout);
  if ('on_rejection' in step && step.on_rejection) transitions.push(step.on_rejection);

  if (step.type === 'gateway') {
    for (const cond of step.conditions) {
      transitions.push(cond.next_step);
    }
    if (step.default_step) transitions.push(step.default_step);
  }

  return transitions;
}

function findCycles(steps: Step[]): string[][] {
  const cycles: string[][] = [];
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(id: string): void {
    if (stack.has(id)) {
      // Found cycle
      const cycleStart = path.indexOf(id);
      cycles.push([...path.slice(cycleStart), id]);
      return;
    }
    if (visited.has(id)) return;

    visited.add(id);
    stack.add(id);
    path.push(id);

    const step = stepMap.get(id);
    if (step) {
      const transitions = getOutgoingTransitions(step);
      for (const target of transitions) {
        dfs(target);
      }
    }

    path.pop();
    stack.delete(id);
  }

  for (const step of steps) {
    if (!visited.has(step.id)) {
      dfs(step.id);
    }
  }

  return cycles;
}
