# v0.1.0
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import typing

# Verdict / Elsa - advanced crypto-native copilot Intelligent Contract.
#
# NOTE: the version + Depends magic comment above MUST be the only leading
# comment block. GenVM reads contiguous leading "#" lines as the runner spec,
# so any descriptive comments have to live below the import (here), never
# between the Depends line and `from genlayer import *`.
#
# Upgrades over the minimal version:
#   1) LIVE DATA UNDER CONSENSUS - the contract fetches live market prices with
#      gl.nondet.web.get inside leader_fn; every validator independently
#      re-fetches and accepts only if prices agree within a tolerance (the
#      grid_oracle pattern). Answers are grounded in consensus-verified live
#      data, not just the frontend's snapshot.
#   2) ON-CHAIN MEMORY - per-wallet conversation history is stored on chain, so
#      Elsa remembers prior turns across messages, sessions, and devices.

# CoinGecko free endpoint: one call returns several majors with price + 24h %.
MARKET_URL = (
    "https://api.coingecko.com/api/v3/simple/price"
    "?ids=bitcoin,ethereum,solana,binancecoin"
    "&vs_currencies=usd&include_24hr_change=true"
)
MARKET_COINS = ("bitcoin", "ethereum", "solana", "binancecoin")
PRICE_TOLERANCE = 0.15      # 15% relative - absorbs volatility between fetches
MAX_TURNS = 6               # keep the last 6 history entries (3 exchanges)
MAX_STORED_ANSWER = 800     # truncate answers kept in the history context


class CryptoChatbot(gl.Contract):
    answers: TreeMap[Address, str]
    history: TreeMap[Address, str]
    last_market: TreeMap[Address, str]

    def __init__(self) -> None:
        pass

    def _fetch_market(self) -> typing.Any:
        resp = gl.nondet.web.get(MARKET_URL, headers={"Accept": "application/json"})
        data = json.loads(resp.body.decode("utf-8"))
        if not isinstance(data, dict):
            raise gl.vm.UserError("Bad market data")
        return data

    def _prices_close(self, a: typing.Any, b: typing.Any) -> bool:
        if not isinstance(a, dict) or not isinstance(b, dict):
            return False
        for coin in MARKET_COINS:
            ca = a.get(coin)
            cb = b.get(coin)
            if not isinstance(ca, dict) or not isinstance(cb, dict):
                return False
            pa = ca.get("usd")
            pb = cb.get("usd")
            if not isinstance(pa, (int, float)) or not isinstance(pb, (int, float)):
                return False
            if pa <= 0 or pb <= 0:
                return False
            if abs(pa - pb) / max(pa, pb) > PRICE_TOLERANCE:
                return False
        return True

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
            market = self._fetch_market()
            prompt = (
                "You are Elsa, a concise crypto-native portfolio copilot.\n"
                "You are given LIVE consensus-verified market prices, the user's "
                "wallet context, and the recent conversation. Use them as ground "
                "truth and stay consistent with earlier turns.\n"
                "Rules: never claim you executed or sent a transaction; never "
                "guarantee future prices, yields, or outcomes; if asked to trade, "
                "give a short checklist and the risks instead of acting; call out "
                "concentration, chain, protocol, liquidity, bridge, and approval "
                "risk when relevant. Be practical and short.\n\n"
                f"Live market (USD, with 24h % change):\n{json.dumps(market)}\n\n"
                f"Wallet context:\n{context}\n\n"
                f"Recent conversation (oldest first):\n{prior_history}\n\n"
                f"User question:\n{question}"
            )
            answer = gl.nondet.exec_prompt(prompt)
            return {"market": market, "answer": answer.strip()}

        def validator_fn(leader_result: typing.Any) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            payload = leader_result.calldata
            if not isinstance(payload, dict):
                return False
            answer = payload.get("answer")
            market = payload.get("market")
            if not isinstance(answer, str) or len(answer.strip()) < 1:
                return False
            my_market = self._fetch_market()
            return self._prices_close(market, my_market)

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        answer = str(result["answer"])

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
        self.last_market[sender] = json.dumps(result["market"])
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
