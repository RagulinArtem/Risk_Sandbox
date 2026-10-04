from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.integrations.ai import committee
from app.integrations.ai.base import AIProviderUnavailableError
from app.schemas.committee import (
    AnalystRequest,
    AnalystView,
    CommitteeRoster,
    CommitteeVerdict,
    VerdictRequest,
)
from app.services.committee_service import build_verdict

# Analysts are separate requests so the UI can show each one as it lands
# (they run in parallel from the browser), then ask the chair.
router = APIRouter(prefix="/api/ai/committee", tags=["ai-committee"])


@router.get("", response_model=CommitteeRoster)
def get_roster() -> CommitteeRoster:
    return committee.roster(get_settings())


@router.post("/analyst", response_model=AnalystView)
def analyst(request: AnalystRequest) -> AnalystView:
    try:
        return committee.run_analyst(
            get_settings(), request.role, request.scenario, request.portfolio
        )
    except AIProviderUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/verdict", response_model=CommitteeVerdict)
def verdict(request: VerdictRequest) -> CommitteeVerdict:
    try:
        return build_verdict(request)
    except AIProviderUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
