"""add tare models and zone type

Revision ID: 7c3f9b1a2f90
Revises: 1d2a3b4c5d6e
Create Date: 2025-12-08 23:45:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7c3f9b1a2f90"
down_revision: Union[str, Sequence[str], None] = "1d2a3b4c5d6e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    zone_type_enum = sa.Enum("inbound", "storage", "outbound", name="zonetype")
    zone_type_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "zones",
        sa.Column(
            "zone_type",
            zone_type_enum,
            nullable=False,
            server_default="storage",
        ),
    )

    op.create_table(
        "tare_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("prefix", sa.String(length=50), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index("ix_tare_types_code", "tare_types", ["code"], unique=True)

    tare_status_enum = sa.Enum(
        "inbound", "storage", "picking", "outbound", "closed", name="tarestates"
    )
    tare_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "tares",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("warehouse_id", sa.Integer(), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("type_id", sa.Integer(), nullable=False),
        sa.Column("tare_code", sa.String(length=100), nullable=False),
        sa.Column("parent_tare_id", sa.Integer(), nullable=True),
        sa.Column("status", tare_status_enum, nullable=False, server_default="inbound"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["parent_tare_id"], ["tares.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["type_id"], ["tare_types.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tare_code", name="uq_tare_code"),
    )
    op.create_index("ix_tares_id", "tares", ["id"], unique=False)
    op.create_index("ix_tares_tare_code", "tares", ["tare_code"], unique=True)

    op.create_table(
        "tare_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tare_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tare_id"], ["tares.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tare_items_id", "tare_items", ["id"], unique=False)

    op.add_column(
        "inventory",
        sa.Column("tare_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_inventory_tare", "inventory", "tares", ["tare_id"], ["id"], ondelete="SET NULL"
    )


def downgrade() -> None:
    op.drop_constraint("fk_inventory_tare", "inventory", type_="foreignkey")
    op.drop_column("inventory", "tare_id")

    op.drop_index("ix_tare_items_id", table_name="tare_items")
    op.drop_table("tare_items")

    op.drop_index("ix_tares_tare_code", table_name="tares")
    op.drop_index("ix_tares_id", table_name="tares")
    op.drop_table("tares")

    op.drop_index("ix_tare_types_code", table_name="tare_types")
    op.drop_table("tare_types")

    tare_status_enum = sa.Enum(
        "inbound", "storage", "picking", "outbound", "closed", name="tarestates"
    )
    tare_status_enum.drop(op.get_bind(), checkfirst=True)

    op.drop_column("zones", "zone_type")
    zone_type_enum = sa.Enum("inbound", "storage", "outbound", name="zonetype")
    zone_type_enum.drop(op.get_bind(), checkfirst=True)

