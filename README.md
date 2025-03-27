# Log Aggregator

A powerful tool for aggregating and analyzing EVM blockchain events.

![Log Aggregator gif](./hypersync.gif)

## Quick Start

```bash
# Monitor ERC20 transfers on Ethereum
pnpx log-aggregator -e "Transfer(address,address,uint256)" -p 2 -n eth

# Monitor Uniswap swaps on Arbitrum
npx log-aggregator -e "Swap(address,uint256,uint256,uint256,address,bytes32)" -p 1 -n arbitrum

# Monitor specific contract on Ethereum
pnpx log-aggregator -e "Transfer(address,address,uint256)" -c 0x1234... -n eth

# Monitor with decimal scaling (e.g., 18 for wei to ETH)
pnpx log-aggregator -e "Transfer(address,address,uint256)" -p 2 -n eth -d 18

# Show help
pnpx log-aggregator --help
```

## Installation

### Global Installation

```bash
# Using npm
npm install -g log-aggregator

# Using yarn
yarn global add log-aggregator

# Using pnpm
pnpm add -g log-aggregator
```

### Local Installation

```bash
# Using npm
npm install log-aggregator

# Using yarn
yarn add log-aggregator

# Using pnpm
pnpm add log-aggregator
```

## Usage

After installation, you can use the following commands:

```bash
# Monitor ERC20 transfers on Ethereum
log-aggregator -e "Transfer(address,address,uint256)" -p 2 -n eth

# Monitor specific contract on Ethereum
log-aggregator -e "Transfer(address,address,uint256)" -c 0x1234... -n eth

# Monitor with decimal scaling (e.g., 18 for wei to ETH)
log-aggregator -e "Transfer(address,address,uint256)" -p 2 -n eth -d 18

# List available networks
log-aggregator --list-networks

# Refresh network list
log-aggregator --refresh-networks
```

## Supported Networks

Log Aggregator automatically discovers and caches all networks supported by Hypersync:

- Ethereum (eth)
- Arbitrum (arbitrum)
- Optimism (optimism)
- Base (base)
- Polygon (polygon)
- BSC (bsc)
- Avalanche (avalanche)
- Fantom (fantom)
- Celo (celo)
- Gnosis Chain (gnosis)
- Linea (linea)
- Scroll (scroll)
- zkSync Era (zksync)
- Starknet (starknet)
- Solana (solana)
- Sui (sui)
- Aptos (aptos)
- NEAR (near)
- Cosmos (cosmos)
- Fuel (fuel)
- Filecoin (filecoin)
- ICP (icp)
- Mina (mina)
- Tezos (tezos)
- Stacks (stacks)
- Algorand (algorand)
- Flow (flow)
- Hedera (hedera)
- Celo (celo)
- Gnosis Chain (gnosis)
- Linea (linea)
- Scroll (scroll)
- zkSync Era (zksync)
- Starknet (starknet)
- Solana (solana)
- Sui (sui)
- Aptos (aptos)
- NEAR (near)
- Cosmos (cosmos)
- Fuel (fuel)
- Filecoin (filecoin)
- ICP (icp)
- Mina (mina)
- Tezos (tezos)
- Stacks (stacks)
- Algorand (algorand)
- Flow (flow)
- Hedera (hedera)

Run `log-aggregator --list-networks` to see the complete, up-to-date list of all supported networks.

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/log-aggregator.git
cd log-aggregator

# Install dependencies
npm install

# Run the tool
node bin/log-aggregator.js
```

## Acknowledgements

- Built with [Hypersync](https://docs.envio.dev/docs/HyperIndex/overview) by Envio
- Terminal UI powered by [blessed](https://github.com/chjj/blessed)
