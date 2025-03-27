# Log Aggregate

A terminal-based UI for aggregating and analyzing blockchain event data using Hypersync.

![Log Aggregate gif](./hypersync.gif)

## Quickstart

Try it with a single command:

```bash
# Aggregate Transfer event amounts for a specific contract on Ethereum
npx log-aggregate -e "Transfer(address from, address to, uint256 amount)" -p "amount" -n eth -c 0xdC035D45d973E3EC169d2276DDab16f1e407384F

# See all available options
log-aggregate --help
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
npm install -g log-aggregate
# or
yarn global add log-aggregate
# or
pnpm add -g log-aggregate
```

## Usage

### CLI

```bash
# Aggregate Transfer event amounts for a specific contract on Ethereum
log-aggregate -e "Transfer(address from, address to, uint256 amount)" -p "amount" -n eth -c 0xdC035D45d973E3EC169d2276DDab16f1e407384F

# Aggregate Uniswap swap amounts for a specific pool
log-aggregate -e "Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)" -p "amount0" -n eth -c 0x1d42064fc4beb5f8aaf85f4617ae8b3b5a8ef603

# List all available networks
log-aggregate --list-networks

# Force refresh the network list from Hypersync API (updates cache)
log-aggregate --refresh-networks

# Show verbose output
log-aggregate -e "Transfer(address,address,uint256)" -p "amount" -c 0xdC035D45d973E3EC169d2276DDab16f1e407384F -v
```

### Network Discovery

Log Aggregate automatically discovers and caches all networks supported by Hypersync:

1. On first run, it loads the default networks
2. It then attempts to fetch all available networks from the Hypersync API
3. Networks are cached locally for future use, even when offline
4. Use `--refresh-networks` to force update the cached network list

This ensures you always have access to all supported networks, even when working offline.

### CLI Options

```
Usage: log-aggregate [options]

Options:
  -V, --version           output the version number
  -e, --event <event>     Event signature to monitor (e.g., "Transfer(address,address,uint256)")
  -p, --parameter <param> Parameter name to aggregate (must be a numeric type)
  -n, --network <network> Network to connect to (e.g., eth, arbitrum, optimism) (default: "eth")
  -c, --contract <addr>   Contract address to monitor (e.g., 0x1234...5678)
  -t, --title <title>     Custom title for the aggregator (default: "Event Data Aggregator")
  -N, --list-networks     List all available networks and exit
  --refresh-networks      Force refresh network list from API
  -v, --verbose           Show additional info in the console
  -h, --help              display help for command
```


## Supported Networks

Log Aggregate automatically discovers all networks supported by Hypersync. The following are some commonly used networks:

### Mainnets

- `eth`: Ethereum Mainnet
- `arbitrum`: Arbitrum One
- `optimism`: Optimism
- `base`: Base
- `polygon`: Polygon PoS
- And many more...

### Testnets

- `arbitrum-sepolia`: Arbitrum Sepolia
- `optimism-sepolia`: Optimism Sepolia
- And more...

Run `log-aggregate --list-networks` to see the complete, up-to-date list of all supported networks.

## Development

```bash
# Clone the repository
git clone https://github.com/denhampreen/log-aggregate.git
cd log-aggregate

# Install dependencies
npm install

# Run the development version
node bin/log-aggregate.js
```

## Acknowledgements

- Built with [Hypersync](https://docs.envio.dev/docs/HyperIndex/overview) by Envio
- Terminal UI powered by [blessed](https://github.com/chjj/blessed)
