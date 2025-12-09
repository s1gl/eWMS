from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Tare, TareType


async def generate_tare_code(session: AsyncSession, tare_type: TareType) -> str:
    prefix = tare_type.prefix or tare_type.code
    stmt = (
        select(Tare.tare_code)
        .where(Tare.type_id == tare_type.id, Tare.tare_code.like(f"{prefix}-%"))
        .order_by(Tare.id.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    last_code = result.scalar_one_or_none()
    last_number = 0
    if last_code and "-" in last_code:
        try:
            last_number = int(last_code.rsplit("-", 1)[-1])
        except ValueError:
            last_number = 0

    # try a few times in case of race; DB unique will still protect
    for step in range(1, 5):
        candidate_num = last_number + step
        candidate = f"{prefix}-{candidate_num:06d}"
        existing = (
            await session.execute(select(Tare.id).where(Tare.tare_code == candidate))
        ).scalar_one_or_none()
        if existing is None:
            return candidate

    # fallback: ask DB for count and append
    count = (
        await session.execute(
            select(Tare.id).where(Tare.type_id == tare_type.id)
        )
    ).scalars().all()
    next_number = len(count) + 1
    return f"{prefix}-{next_number:06d}"
