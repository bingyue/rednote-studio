"""Enforce one active publication and invalidate checks on rule changes."""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade():
    columns = {
        c["name"] for c in sa.inspect(op.get_bind()).get_columns("compliance_checks")
    }
    if "rules_digest" not in columns:
        op.add_column(
            "compliance_checks",
            sa.Column("rules_digest", sa.String(64), nullable=False, server_default=""),
        )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_publish_active_post ON publish_tasks (post_id) WHERE status NOT IN ('CANCELLED','FAILED')"
    )


def downgrade():
    op.drop_index("uq_publish_active_post", table_name="publish_tasks")
    with op.batch_alter_table("compliance_checks") as batch:
        batch.drop_column("rules_digest")
