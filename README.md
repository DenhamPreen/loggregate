# Log Aggregator - loggregate

A powerful tool for aggregating and analyzing EVM blockchain events.

![Log Aggregator gif](./loggregate.gif)

## Quick Start

```bash
# Monitor USDC ERC20 transfers on Base
npx loggregate -e "event Transfer(address indexed from, address indexed to, uint256 value)" -n base -p "value" -c "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" -d 6

# Monitor USDS ERC20 transfers on Ethereum
npx loggregate -e "event Transfer(address indexed from, address indexed to, uint256 value)" -n eth -p "value" -c "0xdC035D45d973E3EC169d2276DDab16f1e407384F" -d 18

# Monitor lst deposits on aPriori monad testnet
npx loggregate -e "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)" -n monad-testnet -p "assets" -c "0xb2f82D0f38dc453D596Ad40A37799446Cc89274A" -d 18 

# A univ3 swap pool usdt on bsc
npx loggregate -e "event Swap(address indexed sender, address indexed recipient, int256 deltaQty0, int256 deltaQty1, uint160 sqrtP, uint128 liquidity, int24 currentTick)" -p "deltaQty0" -n bsc -c "0xF987939b9ea7a43d9e6A39F6542749BB8AFb09BB" -d 18

# Show help
npx loggregate --help
```

## Features

- Real-time aggregation of blockchain event data with a beautiful terminal UI
- Supports **all Hypersync-enabled networks** (Ethereum, Arbitrum, Optimism, etc.)
- Aggregate calculations for numeric event parameters:
  - Count of occurrences
  - Sum of values
  - Average value
  - Minimum value
  - Maximum value
- Progress tracking and statistics
- Automatic network discovery from Hypersync API with persistent caching

## Installation

### Global Installation

```bash
# Using npm
npm install -g loggregate

# Using yarn
yarn global add loggregate

# Using pnpm
pnpm add -g loggregate
```

## Usage

After installation, you can use the following commands:

```bash
loggregate -e <human-readable-abi-event-signature> -p <param-name> -n <network> -d <decimals>

# List available networks
loggregate --list-networks

# Refresh network list
loggregate --refresh-networks
```

## Supported Networks

Log Aggregator automatically discovers and caches all networks supported by Hypersync:

Run `loggregate --list-networks` to see the complete, up-to-date list of all supported networks.

## Development

```bash
# Clone the repository
git clone https://github.com/denhampreen/loggregate.git
cd loggregate

# Install dependencies
npm install

# Run the tool
node bin/loggregate.js
```

## Acknowledgements

- Forked & inspired by [LogTUI](https://github.com/moose-code/logtui) by JonJon Clark
- Built with [Hypersync](https://docs.envio.dev/docs/HyperIndex/overview) by Envio
- Terminal UI powered by [blessed](https://github.com/chjj/blessed)
