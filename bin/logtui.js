#!/usr/bin/env node

/**
 * LogTUI - Command Line Interface
 *
 * A terminal-based UI for monitoring blockchain events using Hypersync
 */

// Force terminal compatibility mode
process.env.FORCE_COLOR = "3";
process.env.NCURSES_NO_UTF8_ACS = "1";

// Handle terminal capability errors before imports
const originalError = console.error;
console.error = function (msg) {
  // Ignore specific terminal capability errors
  if (
    typeof msg === "string" &&
    (msg.includes("Error on xterm") || msg.includes("Setulc"))
  ) {
    return;
  }
  originalError.apply(console, arguments);
};

// Disable debug logging
console.debug = () => {};

import { Command } from "commander";
import chalk from "chalk";
import { createScanner } from "../lib/scanner.js";
import {
  getNetworkUrl,
  NETWORKS,
  DEFAULT_NETWORKS,
  fetchNetworks,
} from "../lib/config.js";

// Create a new command instance
const program = new Command();

// Setup program metadata
program
  .name("logtui")
  .description("A terminal UI for monitoring blockchain events with Hypersync")
  .version("0.1.0");

// Main command
program
  .option("-e, --events <events...>", "Event signatures to monitor")
  .option("-n, --network <network>", "Network to connect to (default: eth)")
  .option(
    "-t, --title <title>",
    "Custom title for the scanner",
    "Blockchain Event Scanner"
  )
  .option("-N, --list-networks", "List all available networks and exit")
  .option("-v, --verbose", "Show additional info in the console")
  .option("--refresh-networks", "Force refresh network list from API")
  .action(async (options) => {
    try {
      // Always fetch networks at startup to ensure we have the latest
      // This uses the cache by default unless --refresh-networks is specified
      if (options.refreshNetworks) {
        console.log(chalk.blue("Refreshing networks from API..."));
        await fetchNetworks(true);
        console.log(chalk.green("Networks refreshed successfully!"));
      } else {
        // Silently ensure networks are loaded (uses cache if available)
        await fetchNetworks();
      }

      // If the user requested to list networks, show them and exit
      if (options.listNetworks) {
        console.log(chalk.bold.blue("\nAvailable Networks:"));
        console.log(chalk.blue("──────────────────────────────────────────"));

        // Separate into categories for better display
        const mainnetNetworks = [];
        const testnetNetworks = [];
        const otherNetworks = [];

        Object.entries(NETWORKS).forEach(([name, url]) => {
          // Categorize networks by name patterns
          if (
            name.includes("sepolia") ||
            name.includes("goerli") ||
            name.includes("testnet") ||
            name.includes("test")
          ) {
            testnetNetworks.push({ name, url });
          } else if (Object.keys(DEFAULT_NETWORKS).includes(name)) {
            mainnetNetworks.push({ name, url });
          } else {
            otherNetworks.push({ name, url });
          }
        });

        console.log(chalk.yellow("\nPopular Mainnets:"));
        mainnetNetworks.forEach(({ name, url }) => {
          console.log(`${chalk.green(name)}: ${url}`);
        });

        console.log(chalk.yellow("\nTestnets:"));
        testnetNetworks.forEach(({ name, url }) => {
          console.log(`${chalk.green(name)}: ${url}`);
        });

        console.log(chalk.yellow("\nOther Networks:"));
        otherNetworks.forEach(({ name, url }) => {
          console.log(`${chalk.green(name)}: ${url}`);
        });

        console.log(
          chalk.yellow(
            `\nTotal ${Object.keys(NETWORKS).length} networks available`
          )
        );

        console.log(chalk.blue("\nUsage Examples:"));
        console.log(
          `${chalk.yellow(
            'logtui -e "Transfer(address,address,uint256)" -n arbitrum'
          )} - Monitor transfers on Arbitrum`
        );
        console.log(
          `${chalk.yellow(
            'logtui -e "Swap(address,uint256,uint256,uint256,address,bytes32)" -n optimism'
          )} - Monitor swaps on Optimism`
        );
        console.log();
        process.exit(0);
      }

      // Determine the network to use
      const network = options.network || "eth";
      let networkUrl;

      try {
        networkUrl = getNetworkUrl(network);
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        console.log(
          chalk.yellow(
            "Run 'logtui --list-networks' to see all available networks."
          )
        );
        process.exit(1);
      }

      // Get event signatures
      const eventSignatures = options.events || [];
      if (eventSignatures.length === 0) {
        console.error(chalk.red("Error: No event signatures provided."));
        console.log(
          chalk.yellow(
            "Please provide event signatures using the -e or --events option."
          )
        );
        process.exit(1);
      }

      if (options.verbose) {
        console.log(chalk.blue("Using event signatures:"));
        eventSignatures.forEach((sig) => console.log(`- ${sig}`));
      }

      // Set the title
      const title = `${options.title} (${network})`;

      if (options.verbose) {
        console.log(chalk.blue(`Starting scanner on ${network}: ${networkUrl}`));
        console.log(
          chalk.blue(`Monitoring ${eventSignatures.length} event types`)
        );
      }

      // Start the scanner
      await createScanner({
        networkUrl,
        eventSignatures,
        title,
      });
    } catch (err) {
      console.error(chalk.red(`Error: ${err.message}`));
      if (err.stack) {
        console.error(chalk.red(err.stack));
      }
      process.exit(1);
    }
  });

// Execute the CLI
async function main() {
  try {
    // Ensure networks are loaded before parsing arguments
    await fetchNetworks();
    program.parse(process.argv);
  } catch (err) {
    console.error(chalk.red(`Fatal error: ${err.message}`));
    process.exit(1);
  }
}

main();
