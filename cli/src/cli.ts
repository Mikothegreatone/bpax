#!/usr/bin/env node

/**
 * BPAX CLI Entry Point
 */

import { Command } from 'commander';
import { validateCommand } from './commands/validate.js';
import { generateCommand } from './commands/generate.js';
import { initCommand } from './commands/init.js';

const program = new Command();

program
  .name('bpax')
  .description('BPAX - Business Process Agent eXchange CLI')
  .version('0.1.0-alpha');

program.addCommand(validateCommand);
program.addCommand(generateCommand);
program.addCommand(initCommand);

export function run(): void {
  program.parse();
}

// Run if executed directly
run();
