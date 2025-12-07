from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.partner import Partner
from app.schemas import PartnerCreate, PartnerRead

router = APIRouter(prefix="/partners", tags=["partners"])


@router.post("", response_model=PartnerRead, status_code=status.HTTP_201_CREATED)
async def create_partner(
    payload: PartnerCreate, session: AsyncSession = Depends(get_session)
):
    existing = (
        await session.execute(select(Partner).where(Partner.code == payload.code))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Partner with code '{payload.code}' already exists",
        )

    partner = Partner(
        name=payload.name,
        code=payload.code,
        type=payload.type,
        is_active=payload.is_active,
    )
    session.add(partner)
    await session.commit()
    await session.refresh(partner)
    return partner


@router.get("", response_model=list[PartnerRead])
async def list_partners(
    type: str | None = None,
    is_active: bool | None = None,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Partner)
    if type:
        stmt = stmt.where(Partner.type == type)
    if is_active is not None:
        stmt = stmt.where(Partner.is_active == is_active)

    result = await session.execute(stmt)
    return result.scalars().all()
