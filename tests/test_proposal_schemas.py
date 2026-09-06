from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.proposal import ProposalCreate


def test_proposal_create_normalizes_cover_letter() -> None:
    # trim user-written proposal text while preserving the freelancer's message
    data = ProposalCreate(
        project_id=1,
        proposed_price=Decimal("750.00"),
        delivery_days=5,
        cover_letter="  I can help.  ",
    )

    assert data.cover_letter == "I can help."


@pytest.mark.parametrize(
    "payload",
    [
        {"project_id": 0},
        {"proposed_price": Decimal("0.00")},
        {"delivery_days": 0},
        {"cover_letter": "   "},
    ],
)
def test_proposal_create_rejects_invalid_inputs(payload: dict[str, object]) -> None:
    # keep invalid proposal data out of service logic and database constraints
    valid_payload = {
        "project_id": 1,
        "proposed_price": Decimal("750.00"),
        "delivery_days": 5,
        "cover_letter": "I can help.",
    }

    with pytest.raises(ValidationError):
        ProposalCreate(**(valid_payload | payload))
