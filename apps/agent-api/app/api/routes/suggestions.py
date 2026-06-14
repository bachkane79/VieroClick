from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import verify_api_secret

router = APIRouter(dependencies=[Depends(verify_api_secret)])


class ReviewSuggestionRequest(BaseModel):
    suggestion_id: str
    status: str  # "accepted" | "rejected"
    reviewer_member_id: str


@router.patch("/{suggestion_id}/review")
async def review_suggestion(
    suggestion_id: str,
    body: ReviewSuggestionRequest,
) -> dict[str, str]:
    # Delegate DB update to Next.js or handle via shared DB client
    return {"suggestion_id": suggestion_id, "status": body.status}
