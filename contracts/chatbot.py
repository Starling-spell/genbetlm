# v0.1.0
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import typing

# Verdict / Elsa - advanced crypto-native copilot Intelligent Contract.
#
# NOTE: the version + Depends magic comment above MUST be the only leading
# comment block. GenVM reads contiguous leading "#" lines as the runner spec,
# so descriptive comments have to live below the import.
#
# Features:
#   1) LIVE DATA - best-effort live market prices via gl.nondet.web.get, fed to
#      the model. A blocked/rate-limited fetch falls back to an empty snapshot.
#   2) ON-CHAIN MEMORY - per-wallet conversation history stored on chain.
#
# Two GenVM constraints this design respects:
#   - calldata can't encode floats, so leader_fn returns the market as a JSON
#     STRING (raw CoinGecko floats must never cross the leader->validator boundary).
#   - reading contract storage inside a nondet block is unsupported, so the fetch
#     is a module-level function and storage is read before/after the nondet block.

# CoinGecko free endpoint: one call returns several majors with price + 24h %.
MARKET_URL = (
    "https://api.coingecko.com/api/v3/simple/price"
    "?ids=bitcoin,ethereum,solana,binancecoin"
    "&vs_currencies=usd&include_24hr_change=true"
)
MAX_TURNS = 6               # keep the last 6 history entries (3 exchanges)
MAX_STORED_ANSWER = 800     # truncate answers kept in the history context


def _fetch_market() -> typing.Any:
    resp = gl.nondet.web.get(MARKET_URL, headers={"Accept": "application/json"})
    data = json.loads(resp.body.decode("utf-8"))
    return data if isinstance(data, dict) else {}


class CryptoChatbot(gl.Contract):
    answers: TreeMap[Address, str]
    history: TreeMap[Address, str]
    last_market: TreeMap[Address, str]

    def __init__(self) -> None:
        pass

    @gl.public.write
    def ask(self, question: str, context: str) -> str:
        question = question.strip()
        if len(question) < 2:
            raise gl.vm.UserError("Question is too short")
        if len(question) > 2000:
            raise gl.vm.UserError("Question is too long")
        context = context.strip()[:12000]

        sender = gl.message.sender_address
        prior_history = self.history.get(sender, "[]")

        def leader_fn() -> typing.Any:
            # Best-effort live market data; a flaky fetch must never break the tx.
            try:
                market = _fetch_market()
            except Exception:
                market = {}
            market_json = json.dumps(market)
            prompt = (
                "You are Elsa, a concise crypto-native portfolio copilot.\n"
                "Use the live market prices (may be empty), the wallet context, and "
                "the recent conversation as ground truth; stay consistent with "
                "earlier turns.\n"
                "Rules: never claim you executed or sent a transaction; never "
                "guarantee future prices, yields, or outcomes; if asked to trade, "
                "give a short checklist and the risks instead of acting; call out "
                "concentration, chain, protocol, liquidity, bridge, and approval "
                "risk when relevant. Be practical and short.\n\n"
                f"Live market (USD, with 24h % change):\n{market_json}\n\n"
                f"Wallet context:\n{context}\n\n"
                f"Recent conversation (oldest first):\n{prior_history}\n\n"
                f"User question:\n{question}"
            )
            answer = gl.nondet.exec_prompt(prompt)
            # Only calldata-encodable strings cross to the validators (no floats).
            return {"market": market_json, "answer": answer.strip()}

        def validator_fn(leader_result: typing.Any) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            payload = leader_result.calldata
            if not isinstance(payload, dict):
                return False
            answer = payload.get("answer")
            return isinstance(answer, str) and len(answer.strip()) >= 1

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        answer = str(result.get("answer", "")).strip()
        if len(answer) == 0:
            raise gl.vm.UserError("Consensus produced an empty answer")

        try:
            turns = json.loads(prior_history)
            if not isinstance(turns, list):
                turns = []
        except Exception:
            turns = []
        turns.append({"role": "user", "content": question})
        turns.append({"role": "assistant", "content": answer[:MAX_STORED_ANSWER]})
        turns = turns[-MAX_TURNS:]

        self.history[sender] = json.dumps(turns)
        self.answers[sender] = answer
        self.last_market[sender] = str(result.get("market", "{}"))
        return answer

    @gl.public.view
    def get_last_answer(self, address: str) -> str:
        return self.answers.get(Address(address), "")

    @gl.public.view
    def get_history(self, address: str) -> str:
        return self.history.get(Address(address), "[]")

    @gl.public.view
    def get_last_market(self, address: str) -> str:
        return self.last_market.get(Address(address), "{}")

    @gl.public.write
    def clear_history(self) -> None:
        sender = gl.message.sender_address
        self.history[sender] = "[]"
        self.answers[sender] = ""
