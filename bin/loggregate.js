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
import { toEventSignature } from "viem";

// Create a new command instance
const program = new Command();

// Setup program metadata
program
  .name("logtui")
  .description("A terminal UI for monitoring blockchain events with Hypersync")
  .version("0.1.0");

// Main command
program
  .option("-e, --event <event>", "Event signature to monitor")
  .option(
    "-p, --param <name>",
    "Name of the event parameter to track (val must be a uint)"
  )
  .option("-c, --contract <address>", "Contract address to monitor")
  .option("-n, --network <network>", "Network to connect to (default: eth)")
  .option(
    "-d, --decimals <number>",
    "Number of decimals to divide values by (e.g. 18 for wei to ETH)",
    "0"
  )
  .option("-b, --from-block <number>", "Starting block number (default: 0)")
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
            'logtui -e "Transfer(address,address,uint256)" -p 2 -n arbitrum'
          )} - Monitor transfer amounts on Arbitrum (third parameter)`
        );
        console.log(
          `${chalk.yellow(
            'logtui -e "Swap(address,uint256,uint256,uint256,address,bytes32)" -p 1 -n optimism'
          )} - Monitor swap amounts on Optimism (second parameter)`
        );
        console.log(
          `${chalk.yellow(
            'logtui -e "Transfer(address,address,uint256)" -c 0x1234... -n eth'
          )} - Monitor transfers from a specific contract`
        );
        console.log(
          `${chalk.yellow(
            'logtui -e "Transfer(address,address,uint256)" -p 2 -b 1000000 -n eth'
          )} - Start scanning from block 1,000,000`
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

      // Get event signature
      const eventSignature = options.event;
      if (!eventSignature) {
        console.error(chalk.red("Error: No event signature provided."));
        console.log(
          chalk.yellow(
            "Please provide an event signature using the -e or --event option."
          )
        );
        process.exit(1);
      }

      try {
        toEventSignature(eventSignature);
      } catch (error) {
        console.error(chalk.red(`Error: Invalid event signature provided.`));
        console.error(
          chalk.yellow(
            `Event signature "${eventSignature}" is invalid human readable abi: ${error.message}`
          )
        );
        console.error(
          chalk.yellow(
            "For info on the human readable abi format click here: https://docs.ethers.org/v5/api/utils/abi/formats/#abi-formats--human-readable-abi"
          )
        );
        process.exit(1);
      }

      // Get event parameter index
      const param = options.param;
      // Validate that the parameter exists in the event signature
      if (!eventSignature.includes(param)) {
        console.error(chalk.red(`Error: Invalid parameter provided.`));
        console.log(
          chalk.yellow(
            `Parameter "${param}" not found in event signature: ${eventSignature}`
          )
        );
        process.exit(1);
      }

      // Get decimals value
      const decimals = parseInt(options.decimals);
      if (isNaN(decimals) || decimals < 0) {
        console.error(chalk.red("Error: Invalid decimals value provided."));
        console.log(
          chalk.yellow(
            "Please provide a valid number of decimals (0 or greater) using the -d or --decimals option."
          )
        );
        process.exit(1);
      }

      // Get from-block value
      let fromBlock = 0;
      if (options.fromBlock) {
        fromBlock = parseInt(options.fromBlock);
        if (isNaN(fromBlock) || fromBlock < 0) {
          console.error(chalk.red("Error: Invalid from-block value provided."));
          console.log(
            chalk.yellow(
              "Please provide a valid block number (0 or greater) using the -b or --from-block option."
            )
          );
          process.exit(1);
        }
      }

      // Get contract address if provided
      let contractAddress = null;
      if (options.contract) {
        // Basic validation for Ethereum address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(options.contract)) {
          console.error(chalk.red("Error: Invalid contract address format."));
          console.log(
            chalk.yellow(
              "Please provide a valid Ethereum address (0x followed by 40 hex characters)."
            )
          );
          process.exit(1);
        }
        contractAddress = options.contract;
      }

      if (options.verbose) {
        console.log(chalk.blue("Using event signature:"));
        console.log(`- ${eventSignature}`);
        console.log(chalk.blue("Tracking parameter:"));
        console.log(`- ${param}`);
        if (contractAddress) {
          console.log(chalk.blue("Monitoring contract:"));
          console.log(`- ${contractAddress}`);
        }
        if (fromBlock > 0) {
          console.log(chalk.blue("Starting from block:"));
          console.log(`- ${fromBlock}`);
        }
      }

      // Set the title
      const title = `${options.title} (${network})`;

      if (options.verbose) {
        console.log(
          chalk.blue(`Starting scanner on ${network}: ${networkUrl}`)
        );
        console.log(chalk.blue("Monitoring event type"));
      }

      // Start the scanner
      await createScanner({
        networkUrl,
        eventSignatureHuman: eventSignature,
        param,
        contractAddress,
        title,
        decimals,
        fromBlock,
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
