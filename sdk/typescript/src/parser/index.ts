/**
 * BPAX Parser
 *
 * Parses BPAX documents from JSON or YAML.
 */

import { parse as parseYaml } from 'yaml';
import { readFile } from 'node:fs/promises';
import type { BPAXDocument } from '../types/index.js';

export interface ParseOptions {
  /** Allow YAML input (default: true) */
  allowYaml?: boolean;
  /** Strict parsing - fail on unknown properties (default: false) */
  strict?: boolean;
}

export interface ParseError {
  path: string;
  message: string;
  line?: number;
  column?: number;
}

export type ParseResult =
  | { success: true; document: BPAXDocument }
  | { success: false; errors: ParseError[] };

/**
 * Parse a BPAX document from a string.
 *
 * @param input - JSON or YAML string
 * @param options - Parse options
 * @returns ParseResult with document or errors
 */
export function parse(input: string, options: ParseOptions = {}): ParseResult {
  const { allowYaml = true } = options;

  // Try to detect format
  const trimmed = input.trim();
  const isJson = trimmed.startsWith('{') || trimmed.startsWith('[');

  try {
    let parsed: unknown;

    if (isJson) {
      parsed = JSON.parse(input);
    } else if (allowYaml) {
      parsed = parseYaml(input);
    } else {
      return {
        success: false,
        errors: [
          {
            path: '',
            message: 'Input is not valid JSON and YAML parsing is disabled',
          },
        ],
      };
    }

    // Basic type check
    if (typeof parsed !== 'object' || parsed === null) {
      return {
        success: false,
        errors: [
          {
            path: '',
            message: 'Document must be an object',
          },
        ],
      };
    }

    // Cast to BPAXDocument - validation happens separately
    return {
      success: true,
      document: parsed as BPAXDocument,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse error';

    // Try to extract line/column from error
    let line: number | undefined;
    let column: number | undefined;

    if (error instanceof SyntaxError) {
      // JSON.parse errors sometimes include position
      const posMatch = message.match(/position (\d+)/);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const lines = input.slice(0, pos).split('\n');
        line = lines.length;
        column = lines[lines.length - 1].length + 1;
      }
    }

    return {
      success: false,
      errors: [
        {
          path: '',
          message: `Parse error: ${message}`,
          line,
          column,
        },
      ],
    };
  }
}

/**
 * Parse a BPAX document from a file.
 *
 * @param path - Path to the file
 * @param options - Parse options
 * @returns ParseResult with document or errors
 */
export async function parseFile(path: string, options: ParseOptions = {}): Promise<ParseResult> {
  try {
    const content = await readFile(path, 'utf-8');
    return parse(content, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown file error';
    return {
      success: false,
      errors: [
        {
          path: '',
          message: `Failed to read file: ${message}`,
        },
      ],
    };
  }
}
