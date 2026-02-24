/**
 * Validate Command
 *
 * Validates BPAX documents against the schema and semantic rules.
 */

import { Command } from 'commander';
import { parseFile, validate } from '@bpax/sdk';
import chalk from 'chalk';

export const validateCommand = new Command('validate')
  .description('Validate a BPAX document')
  .argument('<file>', 'BPAX file to validate')
  .option('--strict', 'Treat warnings as errors')
  .option('--format <format>', 'Output format: pretty, json, sarif', 'pretty')
  .option('-q, --quiet', 'Only output errors')
  .action(async (file: string, options: { strict?: boolean; format: string; quiet?: boolean }) => {
    try {
      // Parse the file
      const parseResult = await parseFile(file);

      if (!parseResult.success) {
        if (options.format === 'json') {
          console.log(JSON.stringify({ valid: false, errors: parseResult.errors }, null, 2));
        } else {
          console.error(chalk.red('Parse Error:'));
          for (const error of parseResult.errors) {
            const location = error.line ? ` (line ${error.line})` : '';
            console.error(chalk.red(`  ${error.message}${location}`));
          }
        }
        process.exit(1);
      }

      // Validate the document
      const result = validate(parseResult.document);

      // Handle strict mode
      const hasErrors = result.errors.length > 0;
      const hasWarnings = result.warnings.length > 0;
      const failed = hasErrors || (options.strict && hasWarnings);

      // Output results
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else if (options.format === 'sarif') {
        // SARIF format for IDE integration
        const sarif = {
          version: '2.1.0',
          $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
          runs: [
            {
              tool: {
                driver: {
                  name: 'bpax',
                  version: '0.1.0-alpha',
                  informationUri: 'https://bpax.io',
                },
              },
              results: [
                ...result.errors.map((e) => ({
                  ruleId: e.code,
                  level: 'error',
                  message: { text: e.message },
                  locations: [
                    {
                      physicalLocation: {
                        artifactLocation: { uri: file },
                        region: { startLine: 1 },
                      },
                    },
                  ],
                })),
                ...result.warnings.map((w) => ({
                  ruleId: w.code,
                  level: 'warning',
                  message: { text: w.message },
                  locations: [
                    {
                      physicalLocation: {
                        artifactLocation: { uri: file },
                        region: { startLine: 1 },
                      },
                    },
                  ],
                })),
              ],
            },
          ],
        };
        console.log(JSON.stringify(sarif, null, 2));
      } else {
        // Pretty format
        if (hasErrors) {
          console.error(chalk.red.bold(`\nErrors (${result.errors.length}):`));
          for (const error of result.errors) {
            console.error(chalk.red(`  [${error.code}] ${error.path}: ${error.message}`));
          }
        }

        if (hasWarnings && !options.quiet) {
          console.warn(chalk.yellow.bold(`\nWarnings (${result.warnings.length}):`));
          for (const warning of result.warnings) {
            console.warn(chalk.yellow(`  [${warning.code}] ${warning.path}: ${warning.message}`));
          }
        }

        if (!failed) {
          console.log(chalk.green(`\n✓ ${file} is valid`));
          if (hasWarnings && !options.quiet) {
            console.log(chalk.yellow(`  (${result.warnings.length} warning(s))`));
          }
        } else {
          console.error(chalk.red(`\n✗ ${file} is invalid`));
        }
      }

      process.exit(failed ? 1 : 0);
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });
