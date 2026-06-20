# GenBetLM

GenBetLM is a Privy-connected Web3 prediction-market product powered by a GenLayer
Intelligent Contract. The app presents a market workspace for drafting YES/NO markets,
reviewing source-backed forecasts, and preparing signed wallet actions.

- **Privy** - wallet login through email, Google, external wallets, or embedded EVM wallets.
- **GenLayer** - `contracts/prediction_market_lm.py` drafts, forecasts, and resolves markets.
- **Web3 UX** - market composer, live market board, trade ticket, and connected account rail.

## Product

The first screen is the market workspace:

- Connect with Privy.
- Draft a source-backed market.
- Track YES/NO probabilities, liquidity, and source metadata.
- Prepare a signed position from the trade panel.

The UI is currently wired as a polished Web3 product surface. The GenLayer market contract is
included and validated; connecting the market action buttons to deployed contract writes is the
next integration step.

## GenLayer Contract

[`contracts/prediction_market_lm.py`](contracts/prediction_market_lm.py) implements GenBetLM:

- `create_ai_market(...)` generates a market question and settlement rule from a topic.
- `forecast_market(...)` fetches evidence and stores a consensus YES probability.
- `resolve_market(...)` resolves after deadline and pays/refunds positions.
- `get_model_card()` returns the product capability and consensus profile.

See [`docs/genbetlm.md`](docs/genbetlm.md) for the model card and equivalence principles.

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Environment variables:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Enables Privy wallet login |
| `NEXT_PUBLIC_PRIVY_CLIENT_ID` | Optional Privy client id |
| `NEXT_PUBLIC_GENLAYER_NETWORK` | GenLayer network, defaults to `studionet` |
| `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS` | Deployed GenLayer contract address |

## Deploy Contract

```bash
GENLAYER_CONTRACT_PATH=contracts/prediction_market_lm.py GENLAYER_NETWORK=studionet GENLAYER_PRIVATE_KEY=0x... npm run deploy:contract
```

Copy the printed address into `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS`.

## Verify

```bash
npx tsc --noEmit --incremental false
npm run build
```

For contract checks:

```bash
pip install -r requirements-contract.txt
genvm-lint check contracts/prediction_market_lm.py
python -m pytest tests/direct/test_prediction_market_lm.py -q
```

## Project Structure

```text
app/
  layout.tsx  page.tsx  providers.tsx  globals.css
components/
  crypto-copilot.tsx       # GenBetLM product workspace
  missing-setup.tsx
contracts/
  prediction_market_lm.py  # GenBetLM Intelligent Contract
  chatbot.py               # legacy copilot contract
docs/
  genbetlm.md
lib/
  chains.ts  format.ts  genlayer-client.ts  zerion.ts
scripts/
  deploy-genlayer.ts
```
