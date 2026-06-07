import pytest
import json
import os
import shutil
from django.contrib.auth import get_user_model
from django.test import Client
from django.conf import settings
from strategy.models import Topic, TaskLedgerEntry

pytestmark = pytest.mark.django_db

@pytest.fixture
def client():
    return Client()

@pytest.fixture
def user1():
    User = get_user_model()
    return User.objects.create_user(username="pm_alice", password="password")

@pytest.fixture
def topic(user1):
    return Topic.objects.create(
        title="Search for Supermarket",
        description="Strategic context",
        owner=user1,
        status="active"
    )

@pytest.fixture
def task(topic):
    return TaskLedgerEntry.objects.create(
        topic=topic,
        title="Create Algolia implementation plan",
        task_type="implementation_plan",
        risk_level="medium",
        approval_required=True,
        status="proposed"
    )

def test_documents_lifecycle(client, user1, topic, task, settings, tmp_path):
    client.force_login(user1)
    
    # Isolate document path in settings
    settings.STRATEGY_DOCUMENTS_DIR = str(tmp_path)
    doc_dir = str(tmp_path)
    
    # 1. Test Listing when no files exist
    response = client.get(f"/api/topics/{topic.id}/documents/")
    assert response.status_code == 200
    assert response.json() == []
    
    # 2. Test Creating a user document
    payload = {
        "title": "Manual Test Document",
        "content": "# Manual Test Document\nSome content."
    }
    response = client.post(
        f"/api/topics/{topic.id}/documents/",
        data=json.dumps(payload),
        content_type="application/json"
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Manual Test Document"
    assert data["type"] == "user"
    assert data["status"] == "active"
    filename = data["filename"]
    
    # Verify the file is created on disk
    file_path = os.path.join(doc_dir, filename)
    assert os.path.exists(file_path)
    
    # 3. Create a simulated task document file on disk
    task_filename = f"task_{task.id}_test_doc.md"
    task_file_path = os.path.join(doc_dir, task_filename)
    with open(task_file_path, "w", encoding="utf-8") as f:
        f.write("# Detailed Strategy Document: Algolia Doc\nTask content here.")
        
    # 4. List documents and check if both appear
    response = client.get(f"/api/topics/{topic.id}/documents/")
    assert response.status_code == 200
    docs = response.json()
    assert len(docs) == 2
    
    # Check manual document
    manual_doc = next(d for d in docs if d["filename"] == filename)
    assert manual_doc["type"] == "user"
    assert manual_doc["status"] == "active"
    
    # Check generated document
    gen_doc = next(d for d in docs if d["filename"] == task_filename)
    assert gen_doc["type"] == "generated"
    assert gen_doc["title"] == "Algolia Doc"
    assert gen_doc["status"] == "active"
    
    # 5. Archive user document
    response = client.post(
        f"/api/topics/{topic.id}/documents/archive/",
        data=json.dumps({"filename": filename}),
        content_type="application/json"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "archived"
    
    # Verify file moved to archive directory
    archive_dir = os.path.join(doc_dir, "archive")
    archived_file_path = os.path.join(archive_dir, filename)
    assert not os.path.exists(file_path)
    assert os.path.exists(archived_file_path)
    
    # Verify lists shows user document as archived
    response = client.get(f"/api/topics/{topic.id}/documents/")
    docs = response.json()
    manual_doc = next(d for d in docs if d["filename"] == filename)
    assert manual_doc["status"] == "archived"
    
    # 6. Restore user document
    response = client.post(
        f"/api/topics/{topic.id}/documents/restore/",
        data=json.dumps({"filename": filename}),
        content_type="application/json"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "restored"
    assert os.path.exists(file_path)
    assert not os.path.exists(archived_file_path)
    
    # 7. Delete both files
    response = client.post(
        f"/api/topics/{topic.id}/documents/delete/",
        data=json.dumps({"filename": filename}),
        content_type="application/json"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "deleted"
    assert not os.path.exists(file_path)
    
    response = client.post(
        f"/api/topics/{topic.id}/documents/delete/",
        data=json.dumps({"filename": task_filename}),
        content_type="application/json"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "deleted"
    assert not os.path.exists(task_file_path)
    
    # 8. List should be empty again
    response = client.get(f"/api/topics/{topic.id}/documents/")
    assert response.status_code == 200
    assert response.json() == []
