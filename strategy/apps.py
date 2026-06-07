from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)


def _reset_orphaned_tasks(**kwargs):
    """Reset any tasks stuck in in_progress from a previous server crash."""
    from django.db.utils import OperationalError, ProgrammingError
    from django.db.backends.signals import connection_created

    try:
        from strategy.models import TaskLedgerEntry

        stuck = TaskLedgerEntry.objects.filter(status="in_progress")
        count = stuck.count()
        if count:
            stuck.update(status="failed")
            logger.warning(
                "Startup cleanup: reset %d orphaned in_progress task(s) to 'failed'. "
                "These were left behind by a previous server crash or restart.",
                count,
            )
        else:
            logger.info("Startup cleanup: no orphaned in_progress tasks found.")
        
        # Disconnect signal so this only runs once on the first DB connection
        connection_created.disconnect(dispatch_uid="reset_orphaned_tasks")
    except (OperationalError, ProgrammingError) as exc:
        logger.debug("Startup cleanup skipped — DB not ready: %s", exc)


class StrategyConfig(AppConfig):
    name = "strategy"

    def ready(self):
        import sys

        # Skip during test runs, migrations, or makemigrations
        if any(cmd in sys.argv for cmd in ("test", "migrate", "makemigrations")):
            return

        # Wire cleanup to fire on the first DB connection (runserver, gunicorn, etc.)
        # This avoids the "Accessing DB during app init" RuntimeWarning.
        from django.db.backends.signals import connection_created

        connection_created.connect(_reset_orphaned_tasks, dispatch_uid="reset_orphaned_tasks")
