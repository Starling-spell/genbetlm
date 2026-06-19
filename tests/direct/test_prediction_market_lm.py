from datetime import datetime


def _unix(iso_timestamp: str) -> int:
    return int(datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00")).timestamp())


SETTLEMENT_RULE = (
    "Grade YES if the linked source confirms BTC closed above 100000 USD by the "
    "deadline; grade NO if it confirms BTC closed at or below 100000 USD; grade DRAW "
    "only for an exact push named by the source; grade INVALID if the market is "
    "cancelled; return UNDETERMINED if the source is insufficient."
)


def _deploy_market(direct_deploy):
    return direct_deploy("contracts/prediction_market_lm.py")


def _create_btc_market(contract, direct_vm, direct_alice, *, deadline=1_900_000_000):
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    return contract.create_market(
        "Will BTC close above 100000 USD by the deadline?",
        "https://example.com/btc-market",
        deadline,
        SETTLEMENT_RULE,
        "crypto",
    )


def test_model_card_describes_genlayer_native_market_lm(direct_deploy):
    contract = _deploy_market(direct_deploy)

    card = contract.get_model_card()

    assert card["name"] == "GenMarketLM"
    assert card["native_runtime"] == "GenLayer Intelligent Contract"
    assert "resolve markets from source evidence after deadline" in card["capabilities"]


def test_create_market_validates_question_source_and_rule(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = _deploy_market(direct_deploy)
    direct_vm.warp("2026-04-01T00:00:00Z")

    with direct_vm.expect_revert("Resolution source must be a valid http or https URL"):
        contract.create_market(
            "Will BTC close above 100000 USD by the deadline?",
            "not-a-url",
            _unix("2026-04-02T00:00:00Z"),
            SETTLEMENT_RULE,
            "crypto",
        )

    with direct_vm.expect_revert("Question must be phrased as a YES/NO question"):
        contract.create_market(
            "BTC closes above 100000 USD",
            "https://example.com/btc-market",
            _unix("2026-04-02T00:00:00Z"),
            SETTLEMENT_RULE,
            "crypto",
        )

    direct_vm.sender = direct_alice
    market_id = contract.create_market(
        "Will BTC close above 100000 USD by the deadline?",
        "https://example.com/btc-market",
        _unix("2026-04-02T00:00:00Z"),
        SETTLEMENT_RULE,
        "crypto",
    )

    market = contract.get_market(market_id)
    assert market["state"] == "open"
    assert market["category"] == "crypto"
    assert market["implied_yes_probability_bps"] == 5000


def test_create_ai_market_uses_consensus_validated_market_draft(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = _deploy_market(direct_deploy)
    direct_vm.warp("2026-04-01T00:00:00Z")
    direct_vm.sender = direct_alice
    direct_vm.mock_llm(
        r"(?s).*market-drafting model.*BTC.*",
        {
            "question": "Will BTC close above 100000 USD by the deadline?",
            "settlement_rule": SETTLEMENT_RULE,
        },
    )

    market_id = contract.create_ai_market(
        "BTC closes above 100000 USD",
        "https://example.com/btc-market",
        _unix("2026-04-02T00:00:00Z"),
        "Crypto Prices",
        "Use the linked source only.",
    )

    market = contract.get_market(market_id)
    assert market["question"] == "Will BTC close above 100000 USD by the deadline?"
    assert market["category"] == "crypto-prices"
    assert market["settlement_rule"] == SETTLEMENT_RULE


def test_buy_position_tracks_yes_no_pools_and_user_position(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
):
    contract = _deploy_market(direct_deploy)
    direct_vm.warp("2026-04-01T00:00:00Z")
    market_id = _create_btc_market(
        contract,
        direct_vm,
        direct_alice,
        deadline=_unix("2026-04-02T00:00:00Z"),
    )

    direct_vm.sender = direct_alice
    direct_vm.value = 5
    contract.buy_position(market_id, "yes", 5)

    direct_vm.sender = direct_bob
    direct_vm.value = 3
    contract.buy_position(market_id, "no", 3)

    market = contract.get_market(market_id)
    alice_position = contract.get_position(market_id, f"0x{direct_alice.hex()}")
    bob_position = contract.get_position(market_id, f"0x{direct_bob.hex()}")

    assert market["yes_pool"] == 5
    assert market["no_pool"] == 3
    assert market["participant_count"] == 2
    assert alice_position["yes_amount"] == 5
    assert bob_position["no_amount"] == 3


def test_forecast_market_stores_probability_and_summary(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
):
    contract = _deploy_market(direct_deploy)
    direct_vm.warp("2026-04-01T00:00:00Z")
    market_id = _create_btc_market(
        contract,
        direct_vm,
        direct_alice,
        deadline=_unix("2026-04-02T00:00:00Z"),
    )
    direct_vm.sender = direct_bob
    contract.buy_position(market_id, "no", 4)

    direct_vm.mock_web(
        r".*example\.com/btc-market.*",
        {
            "status": 200,
            "body": "Market reference: BTC is trading near 101000 USD before the close.",
        },
    )
    direct_vm.mock_llm(
        r"(?s).*cautious forecasting model.*Will BTC close above 100000 USD.*",
        {
            "yes_probability_bps": 6100,
            "confidence": 64,
            "rationale": "The source currently puts BTC slightly above the threshold.",
            "drivers": "Price is above the line.",
            "caveats": "Close has not happened yet.",
        },
    )

    direct_vm.sender = direct_alice
    forecast = contract.forecast_market(market_id)
    market = contract.get_market(market_id)

    assert forecast["yes_probability_bps"] == 6100
    assert market["forecast_count"] == 1
    assert market["last_probability_bps"] == 6100
    assert market["last_forecast_confidence"] == 64
    assert "BTC slightly above" in market["last_forecast_summary"]


def test_resolve_market_after_deadline_pays_consensus_outcome(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
):
    contract = _deploy_market(direct_deploy)
    direct_vm.warp("2026-04-01T00:00:00Z")
    market_id = _create_btc_market(
        contract,
        direct_vm,
        direct_alice,
        deadline=_unix("2026-04-02T00:00:00Z"),
    )

    direct_vm.sender = direct_alice
    contract.buy_position(market_id, "yes", 5)
    direct_vm.sender = direct_bob
    contract.buy_position(market_id, "no", 3)

    direct_vm.mock_web(
        r".*example\.com/btc-market.*",
        {
            "status": 200,
            "body": "Official close: BTC closed at 101250 USD by the deadline.",
        },
    )
    direct_vm.mock_llm(
        r"(?s).*impartial resolver.*Will BTC close above 100000 USD.*",
        {
            "outcome": "YES",
            "confidence": 92,
            "explanation": "The linked source reports BTC closed above 100000 USD.",
        },
    )

    direct_vm.warp("2026-04-03T00:00:00Z")
    direct_vm.sender = direct_bob
    contract.resolve_market(market_id)

    market = contract.get_market(market_id)
    assert market["state"] == "resolved"
    assert market["winner_side"] == "yes"
    assert market["resolve_attempts"] == 1
    assert market["resolution_confidence"] == 92
    assert "closed above" in market["resolution_summary"]


def test_undetermined_resolution_keeps_market_open_for_retry(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = _deploy_market(direct_deploy)
    direct_vm.warp("2026-04-01T00:00:00Z")
    market_id = _create_btc_market(
        contract,
        direct_vm,
        direct_alice,
        deadline=_unix("2026-04-02T00:00:00Z"),
    )

    contract._run_resolution = lambda market: {
        "outcome": "undetermined",
        "confidence": 21,
        "explanation": "The linked source has not published a final close.",
    }

    direct_vm.warp("2026-04-03T00:00:00Z")
    contract.resolve_market(market_id)

    market = contract.get_market(market_id)
    assert market["state"] == "open"
    assert market["winner_side"] == ""
    assert market["resolve_attempts"] == 1
    assert market["resolution_confidence"] == 21
