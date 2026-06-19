# Verdict — GenLayer crypto copilot

A minimal crypto-native chatbot where **GenLayer is the brain**. Every chat message is a
GenLayer transaction the user approves in their wallet, and the answer comes from validator
**consensus** — not a single server. Each reply is a *verdict*: an LLM answer plus a risk read,
settled on-chain.

- **Privy** — wallet login (email / Google / external) + an embedded EVM wallet to sign with.
- **Zerion** — live portfolio context, fetched server-side so the API key stays private.
- **GenLayer** — an Intelligent Contract runs the LLM under Optimistic Democracy consensus.

## How a message works

1. You log in with Privy and your wallet loads a Zerion portfolio snapshot (server-side).
2. You send a message. The app builds a compact portfolio context and calls the contract with
   [`genlayer-js`](lib/genlayer-client.ts):
   - `client.connect("studionet")` adds/switches your wallet to GenLayer chain `61999`.
   - `client.writeContract({ functionName: "ask", args: [question, context] })`.
3. **Privy shows a transaction approval** — you approve it.
4. Validators reach consensus on the answer; the app reads it back and renders it with the tx hash.

> Each message = a wallet approval + a short consensus wait + a little GEN gas. That is the point:
> the answer is settled on-chain.

## The contract

[`contracts/chatbot.py`](contracts/chatbot.py) is intentionally tiny:

```python
@gl.public.write
def ask(self, question: str, context: str) -> str:
    # runs the LLM (JSON: answer + risk_level) under the comparative Equivalence
    # Principle, stores it per sender address, and returns the answer
@gl.public.view
def get_last_answer(self, address: str) -> str: ...   # also get_my_last_answer()
```

It takes the portfolio context as an argument, so it needs **no public proxy** and no
`set_zerion_base_url` step — the frontend supplies the data and the Zerion key never leaves the
server. The prompt also treats the context as untrusted input to resist prompt injection.

Currently deployed on **studionet** at
[`0x16822c3905f0B6B8398A1faE8Fc0178D5Bbf0332`](https://explorer-studio.genlayer.com/address/0x16822c3905f0B6B8398A1faE8Fc0178D5Bbf0332).

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000
```

Environment variables:

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_PRIVY_APP_ID` | client | Privy login + embedded wallets |
| `ZERION_API_KEY` | server | Live portfolio data (stays private) |
| `NEXT_PUBLIC_GENLAYER_NETWORK` | client | `studionet` (default) |
| `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS` | client | Address of the deployed contract |

Without `ZERION_API_KEY` the app uses a demo portfolio so you can still test the flow.

## Deploy the contract

Deploy [`contracts/chatbot.py`](contracts/chatbot.py) to studionet via the
[GenLayer Studio](https://studio.genlayer.com) UI, or with the included script:

```bash
GENLAYER_NETWORK=studionet GENLAYER_PRIVATE_KEY=0x... npx tsx scripts/deploy-genlayer.ts
```

Copy the printed address into `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS`.

**Funding:** the wallet that signs each message needs studionet **GEN** for gas. Fund your Privy
wallet address from the GenLayer Studio faucet. (If studio funding is awkward, switch
`NEXT_PUBLIC_GENLAYER_NETWORK` to `testnetAsimov`, redeploy there, and use the public
[testnet faucet](https://testnet-faucet.genlayer.foundation/), which funds any address.)

## Ship to Vercel via GitHub

1. Push this repo to GitHub (`.env.local` is gitignored — secrets stay out).
2. Import the repo in Vercel (framework auto-detected as Next.js).
3. Add the env vars above in **Project → Settings → Environment Variables**.
4. Deploy with the default settings.

## Project structure

```text
app/
  api/wallet/[address]/route.ts   # server-side Zerion fetch (key stays private)
  layout.tsx  page.tsx  providers.tsx  globals.css
components/
  crypto-copilot.tsx              # the minimal chat UI
  missing-setup.tsx
contracts/
  chatbot.py                      # the GenLayer brain
lib/
  genlayer-client.ts             # askGenLayer(): connect → write → wait → read
  chains.ts                      # studionet as a viem chain for Privy
  zerion.ts  types.ts  format.ts
scripts/
  deploy-genlayer.ts
```

## Docs used

- [GenLayer JS SDK](https://docs.genlayer.com/api-references/genlayer-js) · [Equivalence Principle](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle) · [Deploying](https://docs.genlayer.com/developers/intelligent-contracts/deploying)
- [Privy React setup](https://docs.privy.io/basics/react/setup) · [Ethereum provider](https://docs.privy.io/wallets/using-wallets/ethereum/ethereum-provider)
- [Zerion auth](https://developers.zerion.io/authentication) · [Wallet portfolio](https://developers.zerion.io/api-reference/wallets/get-wallet-portfolio)
