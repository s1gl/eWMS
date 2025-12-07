"""add core wms tables

Revision ID: 1d2a3b4c5d6e
Revises: 95dc05af8d39
Create Date: 2025-12-07 21:40:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1d2a3b4c5d6e"
down_revision: Union[str, Sequence[str], None] = "95dc05af8d39"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "partners",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column(
            "type",
            sa.Enum("customer", "supplier", name="partnertype"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index(op.f("ix_partners_id"), "partners", ["id"], unique=False)
    op.create_index(op.f("ix_partners_code"), "partners", ["code"], unique=True)

    op.create_table(
        "inbound_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("external_number", sa.String(length=100), nullable=False),
        sa.Column("warehouse_id", sa.Integer(), sa.ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("partner_id", sa.Integer(), sa.ForeignKey("partners.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "status",
            sa.Enum("draft", "in_progress", "completed", "cancelled", name="inboundstatus"),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
    )
    op.create_index(op.f("ix_inbound_orders_id"), "inbound_orders", ["id"], unique=False)

    op.create_table(
        "outbound_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("external_number", sa.String(length=100), nullable=False),
        sa.Column("warehouse_id", sa.Integer(), sa.ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("partner_id", sa.Integer(), sa.ForeignKey("partners.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "status",
            sa.Enum("draft", "picking", "packed", "shipped", "cancelled", name="outboundstatus"),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
    )
    op.create_index(op.f("ix_outbound_orders_id"), "outbound_orders", ["id"], unique=False)

    op.create_table(
        "picking_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("warehouse_id", sa.Integer(), sa.ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("outbound_order_id", sa.Integer(), sa.ForeignKey("outbound_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "status",
            sa.Enum("new", "in_progress", "done", name="pickingstatus"),
            nullable=False,
            server_default="new",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
    )
    op.create_index(op.f("ix_picking_tasks_id"), "picking_tasks", ["id"], unique=False)

    op.create_table(
        "inbound_order_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("inbound_order_id", sa.Integer(), sa.ForeignKey("inbound_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expected_qty", sa.Integer(), nullable=False),
        sa.Column("received_qty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("line_status", sa.String(length=50), nullable=True),
    )
    op.create_index(op.f("ix_inbound_order_lines_id"), "inbound_order_lines", ["id"], unique=False)

    op.create_table(
        "outbound_order_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("outbound_order_id", sa.Integer(), sa.ForeignKey("outbound_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ordered_qty", sa.Integer(), nullable=False),
        sa.Column("picked_qty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("shipped_qty", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(op.f("ix_outbound_order_lines_id"), "outbound_order_lines", ["id"], unique=False)

    op.create_table(
        "picking_task_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("picking_task_id", sa.Integer(), sa.ForeignKey("picking_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_location_id", sa.Integer(), sa.ForeignKey("locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("qty_to_pick", sa.Integer(), nullable=False),
        sa.Column("qty_picked", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(op.f("ix_picking_task_lines_id"), "picking_task_lines", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_picking_task_lines_id"), table_name="picking_task_lines")
    op.drop_table("picking_task_lines")
    op.drop_index(op.f("ix_outbound_order_lines_id"), table_name="outbound_order_lines")
    op.drop_table("outbound_order_lines")
    op.drop_index(op.f("ix_inbound_order_lines_id"), table_name="inbound_order_lines")
    op.drop_table("inbound_order_lines")
    op.drop_index(op.f("ix_picking_tasks_id"), table_name="picking_tasks")
    op.drop_table("picking_tasks")
    op.drop_index(op.f("ix_outbound_orders_id"), table_name="outbound_orders")
    op.drop_table("outbound_orders")
    op.drop_index(op.f("ix_inbound_orders_id"), table_name="inbound_orders")
    op.drop_table("inbound_orders")
    op.drop_index(op.f("ix_partners_code"), table_name="partners")
    op.drop_index(op.f("ix_partners_id"), table_name="partners")
    op.drop_table("partners")
    op.execute("DROP TYPE IF EXISTS partnertype")
    op.execute("DROP TYPE IF EXISTS inboundstatus")
    op.execute("DROP TYPE IF EXISTS outboundstatus")
    op.execute("DROP TYPE IF EXISTS pickingstatus")
