"""Add inbound receipts and extend inbound statuses

Revision ID: b1c2d3e4f5a6
Revises: 7c3f9b1a2f90
Create Date: 2025-12-10 10:25:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5a6"
down_revision = "7c3f9b1a2f90"
branch_labels = None
depends_on = None


def upgrade():
    # extend inboundstatus enum with new values (if not exists)
    op.execute("ALTER TYPE inboundstatus ADD VALUE IF NOT EXISTS 'ready_for_receiving'")
    op.execute("ALTER TYPE inboundstatus ADD VALUE IF NOT EXISTS 'receiving'")
    op.execute("ALTER TYPE inboundstatus ADD VALUE IF NOT EXISTS 'received'")
    op.execute("ALTER TYPE inboundstatus ADD VALUE IF NOT EXISTS 'problem'")
    op.execute("ALTER TYPE inboundstatus ADD VALUE IF NOT EXISTS 'mis_sort'")

    condition_enum = sa.Enum("good", "defect", "quarantine", name="inboundcondition")
    condition_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "inbound_receipts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "inbound_order_id",
            sa.Integer(),
            sa.ForeignKey("inbound_orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "line_id",
            sa.Integer(),
            sa.ForeignKey("inbound_order_lines.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "tare_id",
            sa.Integer(),
            sa.ForeignKey("tares.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "item_id",
            sa.Integer(),
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("condition", condition_enum, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("inbound_receipts")
    op.execute("DROP TYPE IF EXISTS inboundcondition")
