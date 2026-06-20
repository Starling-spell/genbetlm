# GenBetLM

GenBetLM is a GenLayer-native prediction-market language model implemented as an
Intelligent Contract in `contracts/prediction_market_lm.py`.

It is not a separately trained centralized model. On GenLayer, the native primitive is a
contract that asks validator LLMs to reason over market text and source evidence, then
commits only the normalized result that passes validator consensus.

## What It Does

- Drafts neutral YES/NO market terms from a creator topic.
- Runs source-backed forecasts that output a YES probability in basis points.
- Resolves markets after the deadline from public web evidence.
- Pays a pari-mutuel YES/NO pool to the winning side.
- Refunds DRAW, INVALID, and no-winner edge cases.

## Inspired By

- PROVEN: source-backed claim lifecycle and hard deadline settlement.
- VerdictDotFun Oracle Forecast: generated forecast questions and source-backed outcomes.
- RJP-style judgment flows: normalized outputs and explicit reasoning artifacts.
- GenLayer docs: nondeterministic LLM calls guarded by validator recomputation.

## Equivalence Principles

GenBetLM uses three different validator checks:

- Market drafts: validators accept the leader result if it is a valid, resolvable YES/NO
  market spec. They do not require identical wording.
- Forecasts: validators accept the leader result when their local YES probability is
  within 1000 bps. Forecasting is probabilistic, so exact equality is the wrong target.
- Resolutions: validators must agree on the normalized outcome: `yes`, `no`, `draw`,
  `invalid`, or `undetermined`.

## Core Methods

- `create_market(...)`: create a manually specified source-backed market.
- `create_ai_market(...)`: generate market question and settlement rule from a topic.
- `buy_position(...)`: buy YES or NO exposure with an explicit `stake_amount`.
- `forecast_market(...)`: fetch evidence and store a consensus forecast.
- `resolve_market(...)`: resolve after the deadline and pay/refund positions.
- `get_model_card()`: return the contract's capability and consensus profile.

## Bradbury Compatibility

The contract follows the existing PROVEN caveat: use explicit `stake_amount` arguments
instead of trusting `gl.message.value`, because Bradbury can report message value as zero
inside GenVM even when the EVM layer transfers GEN.
