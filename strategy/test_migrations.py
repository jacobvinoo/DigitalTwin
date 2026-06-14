import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

@pytest.mark.django_db
def test_no_missing_migrations():
    """
    Ensure that all model changes have been reflected in migrations.
    If this test fails, you need to run `python manage.py makemigrations`.
    """
    try:
        call_command('makemigrations', check=True, dry_run=True)
    except SystemExit as e:
        # makemigrations --check exits with status 1 if there are missing migrations
        if e.code != 0:
            pytest.fail("Missing migrations. Run 'python manage.py makemigrations'")
    except CommandError as e:
        pytest.fail(f"Missing migrations or migration error: {str(e)}")
