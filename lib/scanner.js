/**
 * Core scanner module for logtui
 * Handles connecting to Hypersync and displaying the TUI
 */
import { keccak256, toHex, decodeEventLog, parseAbi, toEventSignature } from "viem";
import {
  HypersyncClient,
  Decoder,
  LogField,
  JoinMode,
  BlockField,
  TransactionField,
} from "@envio-dev/hypersync-client";
import blessed from "blessed";
import contrib from "blessed-contrib";
import chalk from "chalk";
import figlet from "figlet";
import supportsColor from "supports-color";

let onlyOnce = true;

const logOnlyOnce = (toLogs) => {
  if (onlyOnce) {
    console.log("only-once");
    toLogs.forEach((toLog) => {
      console.log(toLog);
    });    
    onlyOnce = false;
  }
};


// Force terminal compatibility mode - stronger settings
// process.env.FORCE_COLOR = "3"; // Force full true color support - REMOVING THIS
process.env.NCURSES_NO_UTF8_ACS = "1";
process.env.TERM = "xterm-256color"; // Use more compatible terminal type

// Ensure chalk uses normal level for auto-detection
// chalk.level = 3; // REMOVING FORCED LEVEL

// Detect actual terminal color support
const hasColorSupport = !!supportsColor.stdout;
const has256ColorSupport = !!(
  supportsColor.stdout && supportsColor.stdout.has256
);
const hasTrueColorSupport = !!(
  supportsColor.stdout && supportsColor.stdout.has16m
);

// Log color support detection for verbose mode
if (process.env.DEBUG) {
  console.log(`Terminal color support detected:
  - Basic colors: ${hasColorSupport}
  - 256 colors: ${has256ColorSupport}
  - True colors: ${hasTrueColorSupport}
`);
}

// Apply completely silent error handling for Blessed/Terminal issues
const originalConsoleError = console.error;
console.error = function (...args) {
  // Check if this is a terminal capability error
  if (args.length > 0 && typeof args[0] === "string") {
    const errorMsg = args[0];
    if (
      errorMsg.includes("Error on xterm") ||
      errorMsg.includes("Setulc") ||
      errorMsg.includes("stack") ||
      errorMsg.includes("term") ||
      errorMsg.includes("escape sequence")
    ) {
      return; // Silently ignore these errors
    }
  }
  originalConsoleError.apply(console, args);
};

// Apply monkey patch to process.stderr.write to catch any remaining errors
const originalStderrWrite = process.stderr.write;
process.stderr.write = function (buffer, encoding, fd) {
  const str = buffer.toString();
  if (
    str.includes("Error on xterm") ||
    str.includes("Setulc") ||
    str.includes("stack") ||
    str.includes("var v") ||
    str.includes("terminal capability") ||
    str.includes("xterm-256color") ||
    str.toLowerCase().includes("setulc")
  ) {
    return true; // Pretend we wrote it but don't actually write
  }
  return originalStderrWrite.apply(process.stderr, arguments);
};

/**
 * Format numbers with commas
 * @param {number|string} num - Number to format
 * @returns {string} Formatted number
 */
const formatNumber = (num) => {
  if (num === null || num === undefined) return "0";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

/**
 * Safe JSON stringify that handles circular references
 * @param {Object} obj - Object to stringify
 * @param {number} maxLength - Maximum length before truncating
 * @returns {string} Stringified object
 */
const safeStringify = (obj, maxLength = 100) => {
  try {
    if (!obj) return "null";
    const str = JSON.stringify(obj);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + "...";
  } catch (err) {
    return `[Object: stringify failed]`;
  }
};

/**
 * Create and run the scanner with TUI
 * @param {Object} options - Scanner options
 * @param {string} options.networkUrl - Hypersync network URL
 * @param {string} options.eventSignature - Event signature to scan for
 * @param {string} options.contractAddress - Contract address to monitor (optional)
 * @param {string} options.title - Title for the TUI
 * @param {number} options.decimals - Number of decimals for formatting
 * @returns {Promise<void>}
 */
export async function createScanner({
  networkUrl,
  eventSignatureHuman,
  param,
  contractAddress,
  title = "Event Scanner",
  decimals = 0,
}) {

  const eventSignature = toEventSignature(eventSignatureHuman);  

  // Initialize Hypersync client
  const client = HypersyncClient.new({
    url: networkUrl,
    bearerToken:
      process.env.HYPERSYNC_BEARER_TOKEN ||
      "7f9820bd-5f71-47d5-87d3-69952cb3e567", // Default token if not provided
  });

  // Create topic0 hash from event signature
  const topic0 = keccak256(toHex(eventSignature));

  // Define the Hypersync query to get events we're interested in
  let query = {
    fromBlock: 0,
    logs: [
      {
        // Get all events that match the topic0 value we want
        topics: [[topic0]],
        // Add contract address filter if provided
        ...(contractAddress && { address: [contractAddress] }),
      },
    ],
    fieldSelection: {
      log: [LogField.Topic0, LogField.Topic1, LogField.Topic2, LogField.Topic3 , LogField.Data, LogField.TransactionHash, LogField.LogIndex],
    },
    joinMode: JoinMode.JoinTransactions,
  };

  // Track event counts - will be populated dynamically
  const eventAggregates = {
    count: 0,
    Unknown: 0,
    sum: BigInt(0),
    sumSquares: BigInt(0), // Add sum of squares for standard deviation
    min: BigInt(0),
    max: BigInt(0),
    average: BigInt(0),
    variance: BigInt(0), // Add variance field
    stdDev: BigInt(0), // Add standard deviation field
  };

  // Get event name from signature
  const eventName = eventSignature.split("(")[0];
  eventAggregates[eventName] = 0;

  // Create a mapping of topic0 hash to event name
  const topic0ToName = {
    [topic0]: eventName,
  };

  // Function to format BigInt with commas and decimals
  const formatBigInt = (value) => {
    try {
      // Convert to string and handle decimals
      let strValue = value.toString();
      if (decimals > 0) {
        // Pad with zeros if needed
        while (strValue.length <= decimals) {
          strValue = '0' + strValue;
        }
        // Only keep the whole number part
        strValue = strValue.slice(0, -decimals);
      }
      // Add commas for thousands
      return strValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    } catch (error) {
      console.error('Error formatting BigInt:', error);
      return value.toString();
    }
  };

  //=============================================================================
  // TUI SETUP
  //=============================================================================

  // Create blessed screen with improved compatibility settings
  const screen = blessed.screen({
    smartCSR: true,
    title,
    dockBorders: true,
    fullUnicode: true,
    forceUnicode: true,
    autoPadding: true,
    terminal: "xterm-color", // Use simpler terminal type
    fastCSR: true,
    useBCE: true, // Use Background Color Erase for better rendering
  });

  // Define UI color scheme with multiple fallback options tailored to detected capabilities
  // A selection of beautiful baby blue options
  const colorOptions = {
    trueColor: {
      primary: "#FFFFFF", // Pure white for logo
      secondary: "#00BFFF", // Keep baby blue for borders and other elements
      tertiary: "#87CEFA", // Light sky blue as another option
    },
    ansi256: {
      // These are the closest ANSI 256 color codes
      primary: 15, // White
      secondary: 39, // Closest to deep sky blue
      tertiary: 45, // A lighter baby blue
    },
    basic: {
      // When only basic ANSI colors are available
      primary: "white", // Simple white
      secondary: "cyanBright", // For non-logo elements
      fallback: "cyan",
    },
  };

  // Select the best color scheme based on terminal capabilities
  const getOptimalColorScheme = () => {
    if (hasTrueColorSupport) {
      return {
        type: "hex",
        primary: colorOptions.trueColor.primary,
        secondary: colorOptions.trueColor.secondary,
      };
    } else if (has256ColorSupport) {
      return {
        type: "ansi256",
        primary: colorOptions.ansi256.primary,
        secondary: colorOptions.ansi256.secondary,
      };
    } else {
      return {
        type: "basic",
        primary: colorOptions.basic.primary,
        secondary: colorOptions.basic.secondary,
      };
    }
  };

  // Get the best color scheme for this terminal
  const colorScheme = getOptimalColorScheme();

  // Set the active color for border references - still using baby blue for borders
  let uiColor =
    colorScheme.type === "hex"
      ? colorOptions.trueColor.secondary
      : colorOptions.trueColor.secondary;

  // Create enhanced color function with multiple fallbacks based on terminal capabilities
  const safeHexColor = (text) => {
    try {
      if (colorScheme.type === "hex") {
        return chalk.hex(colorScheme.primary)(text);
      } else if (colorScheme.type === "ansi256") {
        return chalk.ansi256(colorScheme.primary)(text);
      } else {
        // Basic color mode
        return chalk[colorScheme.primary](text);
      }
    } catch (e) {
      // Ultimate fallback - use white which should be available everywhere
      return chalk.white(text);
    }
  };

  // Create specific color function for borders and other non-logo elements
  const borderColor = (text) => {
    try {
      if (colorScheme.type === "hex") {
        return chalk.hex(colorScheme.secondary)(text);
      } else if (colorScheme.type === "ansi256") {
        return chalk.ansi256(colorScheme.secondary)(text);
      } else {
        return chalk[colorScheme.secondary](text);
      }
    } catch (e) {
      return chalk.cyanBright(text);
    }
  };

  // Create a grid layout
  const grid = new contrib.grid({
    rows: 12,
    cols: 12,
    screen: screen,
  });

  // Create ASCII logo box
  const logo = grid.set(0, 0, 3, 12, blessed.box, {
    tags: true,
    align: "center",
    valign: "middle",
    border: {
      type: "line",
      fg: uiColor,
    },
  });

  // Define a direct neon cyan color using ANSI escape sequences
  // This should be universally visible in all terminals
  const NEON_CYAN = "\x1b[38;5;51m"; // Bright neon cyan (ANSI 256 color)
  const NEON_CYAN_BG = "\x1b[48;5;51m"; // Bright neon cyan background
  const RESET = "\x1b[0m"; // Reset to default color

  // Create a function to apply the neon cyan color to text - for consistency
  const neonCyanText = (text) => `${NEON_CYAN}${text}${RESET}`;

  // Create ASCII logo with direct approach
  try {
    // Generate the text first
    const logoText = figlet.textSync("ENVIO.DEV", {
      font: "ANSI Shadow",
      horizontalLayout: "full",
    });

    // Color it directly with neon cyan - should work universally
    const coloredLogo = NEON_CYAN + logoText + RESET;

    // Set the content directly
    logo.setContent(coloredLogo);
  } catch (error) {
    // Emergency fallback to plain text if all else fails
    logo.setContent(chalk.cyan.bold("ENVIO.DEV"));
  }

  // Create subtitle
  const subtitle = grid.set(3, 0, 1, 12, blessed.box, {
    content: chalk.yellow(` ${title} - Powered by Envio `),
    tags: true,
    align: "center",
    valign: "middle",
    style: {
      fg: "yellow",
      bold: true,
    },
  });

  // Create a custom progress bar
  const progressBox = grid.set(4, 0, 1, 12, blessed.box, {
    label: " Scanning Progress ",
    tags: true,
    border: {
      type: "line",
      fg: uiColor,
    },
    style: {
      fg: "white",
    },
  });

  // Create stats display
  const stats = grid.set(5, 0, 2, 6, blessed.box, {
    label: "Stats",
    tags: true,
    border: {
      type: "line",
      fg: uiColor,
    },
    style: {
      fg: "white",
    },
  });

  // Create event distribution display
  const eventAggregateDataDisplay = grid.set(5, 6, 2, 6, blessed.box, {
    label: `${eventName} - ${param}: Aggregate stats`,
    tags: true,
    border: {
      type: "line",
      fg: uiColor,
    },
    style: {
      fg: "white",
    },
  });

  // Create log window
  const logWindow = grid.set(7, 0, 4, 12, contrib.log, {
    label: "Event Log",
    tags: true,
    border: {
      type: "line",
      fg: uiColor,
    },
    style: {
      fg: "green",
    },
    bufferLength: 30,
  });

  // Exit on Escape, q, or Ctrl+C
  screen.key(["escape", "q", "C-c"], function (ch, key) {
    return process.exit(0);
  });

  // Custom function to update the progress bar display
  const updateProgressBar = (progress, label = "") => {
    try {
      // Calculate the width of the progress bar (accounting for borders and label)
      const width = progressBox.width - 4;
      const filledWidth = Math.floor(width * progress);
      const emptyWidth = width - filledWidth;

      // Create the progress bar with our neon cyan color
      const filledBar = NEON_CYAN_BG + " ".repeat(filledWidth) + RESET;
      const emptyBar = chalk.bgBlack(" ".repeat(emptyWidth));

      // Update the progress box content
      progressBox.setContent(
        `${filledBar}${emptyBar} ${(progress * 100).toFixed(2)}% ${label}`
      );
    } catch (err) {
      // Silently handle errors
    }
  };

  // Function to update event distribution display using ASCII bars
  const updateDataAggregationDisplay = (eventAggregates) => {
    try {      
      // Add extra spacing for better readability
      const labelWidth = 12;

      // Set the content with each stat on its own line
      const content = 
        `${neonCyanText("Count".padEnd(labelWidth))} ${formatNumber(eventAggregates.count)}\n` +
        `${neonCyanText("Sum".padEnd(labelWidth))} ${formatBigInt(eventAggregates.sum)}\n` +
        `${neonCyanText("Min".padEnd(labelWidth))} ${formatBigInt(eventAggregates.min)}\n` +
        `${neonCyanText("Max".padEnd(labelWidth))} ${formatBigInt(eventAggregates.max)}\n` +
        `${neonCyanText("Avg".padEnd(labelWidth))} ${formatBigInt(eventAggregates.average)}\n` +
        `${neonCyanText("Variance".padEnd(labelWidth))} ${formatBigInt(eventAggregates.variance)}\n` +
        `${neonCyanText("StdDev".padEnd(labelWidth))} ${formatBigInt(eventAggregates.stdDev)}`;

      eventAggregateDataDisplay.setContent(content);
    } catch (err) {
      // Silently handle errors
    }
  };

  // Render the screen
  screen.render();

  //=============================================================================
  // MAIN FUNCTION
  //=============================================================================

  const startTime = performance.now();

  // Log startup
  logWindow.log(chalk.yellow(`Initializing Event Scanner...`));
  screen.render();

  try {
    //=========================================================================
    // STEP 1: Get blockchain height using Hypersync
    //=========================================================================
    const height = await client.getHeight();
    logWindow.log(
      `Starting scan from block ${safeHexColor("0")} to ${safeHexColor(
        formatNumber(height)
      )}`
    );
    screen.render();

    //=========================================================================
    // STEP 2: Create a decoder for the event signature
    //=========================================================================
    const decoder = Decoder.fromSignatures([eventSignature]);
    logWindow.log("Event decoder initialized");
    screen.render();

    //=========================================================================
    // STEP 3: Stream events from Hypersync
    //=========================================================================
    logWindow.log(chalk.green("Starting event stream..."));
    screen.render();
    const stream = await client.stream(query, {});

    // Update subtitle to show network
    subtitle.setContent(
      chalk.yellow(` ${title} - Block Height: ${formatNumber(height)} `)
    );
    screen.render();

    //=========================================================================
    // STEP 4: Process streaming data
    //=========================================================================
    let lastLogUpdate = 0;
    let lastDistributionUpdate = 0;

    // Initialize progress bar
    updateProgressBar(0, `Block: 0/${formatNumber(height)}`);

    // Initialize distribution display
    updateDataAggregationDisplay(eventAggregates);

    screen.render();

    while (true) {
      // Get the next batch of data from Hypersync
      const res = await stream.recv();

      // Quit if we reached the tip of the blockchain
      if (res === null) {
        logWindow.log(chalk.green("✓ Reached the tip of the blockchain!"));
        updateProgressBar(
          1,
          `Block: ${formatNumber(height)}/${formatNumber(height)}`
        );
        screen.render();
        break;
      }

      // Make sure we have a nextBlock value
      if (!res.nextBlock) {
        logWindow.log(chalk.yellow("Warning: Missing nextBlock in response"));
        continue;
      }

      // Process logs if any exist in this batch
      if (
        res.data &&
        res.data.logs &&
        Array.isArray(res.data.logs) &&
        res.data.logs.length > 0
      ) {
        // Process logs based on their topic0 value
        res.data.logs.forEach((log) => {
          if (!log) return; // Skip if log is null

          eventAggregates.count++;

          if (!log.topics || !Array.isArray(log.topics) || !log.topics[0]) {
            eventAggregates.Unknown++;
            return;
          }

          const topic0 = log.topics[0];
          const eventName = topic0ToName[topic0] || "Unknown";

          if (eventName === "Unknown") {
            eventAggregates.Unknown++;
          } else {
            eventAggregates[eventName] = (eventAggregates[eventName] || 0) + 1;

            // Process the data field if it exists
            if (log.data) {

              try {
                
                   // should use the hypersync decoder
                let decodedEvent = decodeEventLog({          
                  abi: parseAbi([eventSignatureHuman]),
                  data: log.data, 
                  topics: log.topics,
                  strict: false
                })

                const value = decodedEvent.args[param];
                eventAggregates.sum = eventAggregates.sum + value;
                eventAggregates.sumSquares = eventAggregates.sumSquares + (value * value);
                
                // Update min and max on first value or if current value is smaller/larger
                if (eventAggregates.count === 1) {
                  eventAggregates.min = value;
                  eventAggregates.max = value;
                } else {
                  if (value < eventAggregates.min) eventAggregates.min = value;
                  if (value > eventAggregates.max) eventAggregates.max = value;
                }

                // Update average
                eventAggregates.average = eventAggregates.sum / BigInt(eventAggregates.count);

                // Calculate standard deviation with decimal place adjustment
                const mean = eventAggregates.average;
                // Adjust for decimals by dividing by 10^decimals before calculating variance
                const adjustedSumSquares = eventAggregates.sumSquares / (BigInt(10) ** BigInt(decimals * 2));
                const adjustedMean = mean / (BigInt(10) ** BigInt(decimals));
                eventAggregates.variance = BigInt(Math.floor(Number((adjustedSumSquares / BigInt(eventAggregates.count)) - (adjustedMean * adjustedMean))));
                // Convert to regular number for sqrt, floor it, then back to BigInt
                eventAggregates.stdDev = BigInt(Math.floor(Math.sqrt(Number(eventAggregates.variance)))) * (BigInt(10) ** BigInt(decimals));
              } catch (error) {
                console.error('Error processing log data:', error);
              }
            }
          }
        });

        // Log a decoded event sample occasionally
        try {
          if (eventAggregates.count % 1000 === 0 && res.data.logs[0]) {
            const decodedLogs = await decoder.decodeLogs([res.data.logs[0]]);
            if (
              decodedLogs &&
              Array.isArray(decodedLogs) &&
              decodedLogs.length > 0 &&
              decodedLogs[0]
            ) {
              const eventInfo = decodedLogs[0].event
                ? safeStringify(decodedLogs[0].event)
                : "No event data";
              logWindow.log(
                neonCyanText(
                  `Sample event at block ${res.nextBlock}: ${eventInfo}`
                )
              );
              screen.render();
            }
          }
        } catch (decodeError) {
          logWindow.log(chalk.yellow(`Decode warning: ${decodeError.message}`));
        }
      }

      // Update the fromBlock for the next iteration
      if (res.nextBlock) {
        query.fromBlock = res.nextBlock;
      }

      // Calculate time stats
      const currentTime = performance.now();
      const seconds = Math.max((currentTime - startTime) / 1000, 0.1); // Avoid division by zero
      const eventsPerSecond = (eventAggregates.count / seconds).toFixed(1);

      // Calculate progress
      const progress = Math.min(res.nextBlock / height, 1);

      // Update the progress bar
      updateProgressBar(
        progress,
        `Block: ${formatNumber(res.nextBlock)}/${formatNumber(height)}`
      );

      // Update stats display
      try {
        stats.setContent(
          `${neonCyanText("Current Block")}: ${formatNumber(res.nextBlock)}\n` +
            `${neonCyanText("Progress")}: ${(progress * 100).toFixed(2)}%\n` +
            `${neonCyanText("Total Events")}: ${formatNumber(
              eventAggregates.count
            )}\n` +
            `${neonCyanText("Elapsed Time")}: ${seconds.toFixed(1)}s\n` +
            `${neonCyanText("Speed")}: ${formatNumber(
              eventsPerSecond
            )} events/s`
        );
      } catch (statsError) {
        // Silently handle errors
      }

      // Update event distribution periodically
      if (res.nextBlock - lastDistributionUpdate >= 10000) {
        updateDataAggregationDisplay(eventAggregates);
        lastDistributionUpdate = res.nextBlock;
      }

      // Log progress periodically to avoid too many updates
      if (res.nextBlock - lastLogUpdate >= 50000) {
        logWindow.log(
          `${neonCyanText("Block")} ${formatNumber(
            res.nextBlock
          )} | ${formatNumber(
            eventAggregates.count
          )} events | ${eventsPerSecond} events/s`
        );
        lastLogUpdate = res.nextBlock;
      }

      // Render the updated screen
      screen.render();
    }

    //=========================================================================
    // Final summary
    //=========================================================================
    const totalTime = Math.max((performance.now() - startTime) / 1000, 0.1); // Avoid division by zero

    // Update final stats
    stats.setContent(
      `${neonCyanText("Blocks Scanned")}: ${formatNumber(height)}\n` +
        `${neonCyanText("Total Events")}: ${formatNumber(
          eventAggregates.count
        )}\n` +
        `${neonCyanText("Elapsed Time")}: ${totalTime.toFixed(1)}s\n` +
        `${neonCyanText("Avg Speed")}: ${formatNumber(
          Math.round(eventAggregates.count / totalTime)
        )} events/s`
    );

    // Final distribution update
    updateDataAggregationDisplay(eventAggregates);

    // Log completion
    logWindow.log(chalk.green("✓ Scan complete!"));
    logWindow.log(
      chalk.yellow(`Total processing time: ${totalTime.toFixed(2)} seconds`)
    );
    logWindow.log(
      chalk.yellow(
        `Average speed: ${formatNumber(
          Math.round(eventAggregates.count / totalTime)
        )} events/second`
      )
    );

    // Bold final message
    subtitle.setContent(chalk.green.bold(" Scan Complete - Press Q to Exit "));

    // Render final screen
    screen.render();

    // Wait for user to exit
    await new Promise((resolve) => setTimeout(resolve, 1000000000));
  } catch (error) {
    logWindow.log(chalk.red(`Error: ${error.message}`));
    screen.render();
    await new Promise((resolve) => setTimeout(resolve, 5000));
    process.exit(1);
  }
}
