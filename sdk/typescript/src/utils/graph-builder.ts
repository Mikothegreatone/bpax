/**
 * Graph Builder Utility
 *
 * Converts a BPAX document into a graph representation for visualization
 * and framework translation.
 */

import type { BPAXDocument, Step } from '../types/index.js';

export interface GraphNode {
  id: string;
  name: string;
  type: Step['type'];
  data: Step;
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

export interface ProcessGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  entryPoints: string[];
  terminalPoints: string[];
}

/**
 * Build a graph representation from a BPAX document.
 *
 * @param document - BPAX document
 * @returns ProcessGraph
 */
export function buildGraph(document: BPAXDocument): ProcessGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Build nodes
  for (const step of document.steps) {
    nodes.push({
      id: step.id,
      name: step.name,
      type: step.type,
      data: step,
    });
  }

  // Build edges
  for (const step of document.steps) {
    // Success transition
    if ('on_success' in step && step.on_success) {
      edges.push({
        source: step.id,
        target: step.on_success,
        label: 'success',
      });
    }

    // Failure transition
    if ('on_failure' in step && step.on_failure) {
      edges.push({
        source: step.id,
        target: step.on_failure,
        label: 'failure',
      });
    }

    // Timeout transition
    if ('on_timeout' in step && step.on_timeout) {
      edges.push({
        source: step.id,
        target: step.on_timeout,
        label: 'timeout',
      });
    }

    // Rejection transition (human tasks)
    if ('on_rejection' in step && step.on_rejection) {
      edges.push({
        source: step.id,
        target: step.on_rejection,
        label: 'rejection',
      });
    }

    // Gateway conditions
    if (step.type === 'gateway') {
      for (const cond of step.conditions) {
        edges.push({
          source: step.id,
          target: cond.next_step,
          label: 'condition',
          condition: cond.condition,
        });
      }

      if (step.default_step) {
        edges.push({
          source: step.id,
          target: step.default_step,
          label: 'default',
        });
      }
    }
  }

  // Find entry points (nodes with no incoming edges)
  const hasIncoming = new Set(edges.map((e) => e.target));
  const entryPoints = nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id);

  // Find terminal points
  const terminalPoints = nodes.filter((n) => n.type === 'terminal').map((n) => n.id);

  return {
    nodes,
    edges,
    entryPoints,
    terminalPoints,
  };
}
