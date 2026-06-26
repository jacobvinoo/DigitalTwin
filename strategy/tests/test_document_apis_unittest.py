from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.conf import settings
from strategy.models import Topic, TaskLedgerEntry
import json, os

class TestDocumentLifecycle(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='pm_alice', password='password')
        self.client = Client()
        self.client.force_login(self.user)
        self.topic = Topic.objects.create(
            title='Search for Supermarket',
            description='Strategic context',
            owner=self.user,
            status='active'
        )
        self.task = TaskLedgerEntry.objects.create(
            topic=self.topic,
            title='Create Algolia implementation plan',
            task_type='implementation_plan',
            risk_level='medium',
            approval_required=True,
            status='proposed'
        )
        # isolate document dir
        self.temp_dir = self._create_temp_dir()
        settings.STRATEGY_DOCUMENTS_DIR = self.temp_dir

    def _create_temp_dir(self):
        import tempfile
        return tempfile.mkdtemp()

    def test_documents_lifecycle(self):
        topic = self.topic
        task = self.task
        doc_dir = self.temp_dir
        # 1. List empty
        response = self.client.get(f'/api/topics/{topic.id}/documents/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])
        # 2. Create user document
        payload = {"title": "Manual Test Document", "content": "# Manual Test Document\nSome content."}
        response = self.client.post(
            f'/api/topics/{topic.id}/documents/',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        filename = data['filename']
        file_path = os.path.join(doc_dir, filename)
        self.assertTrue(os.path.exists(file_path))
        # 3. Simulated task document
        task_filename = f'task_{task.id}_test_doc.md'
        task_file_path = os.path.join(doc_dir, task_filename)
        with open(task_file_path, 'w', encoding='utf-8') as f:
            f.write('# Detailed Strategy Document: Algolia Doc\nTask content here.')
        # 4. List both
        response = self.client.get(f'/api/topics/{topic.id}/documents/')
        self.assertEqual(response.status_code, 200)
        docs = response.json()
        self.assertEqual(len(docs), 2)
        manual_doc = next(d for d in docs if d['filename'] == filename)
        self.assertEqual(manual_doc['type'], 'user')
        gen_doc = next(d for d in docs if d['filename'] == task_filename)
        self.assertEqual(gen_doc['type'], 'generated')
        self.assertEqual(gen_doc['title'], 'Algolia Doc')
        # 5. Archive user doc
        response = self.client.post(
            f'/api/topics/{topic.id}/documents/archive/',
            data=json.dumps({"filename": filename}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'archived')
        archive_dir = os.path.join(doc_dir, 'archive')
        archived_path = os.path.join(archive_dir, filename)
        self.assertFalse(os.path.exists(file_path))
        self.assertTrue(os.path.exists(archived_path))
        # 6. Restore
        response = self.client.post(
            f'/api/topics/{topic.id}/documents/restore/',
            data=json.dumps({"filename": filename}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'restored')
        self.assertTrue(os.path.exists(file_path))
        self.assertFalse(os.path.exists(archived_path))
        # 7. Delete both files
        response = self.client.post(
            f'/api/topics/{topic.id}/documents/delete/',
            data=json.dumps({"filename": filename}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'deleted')
        self.assertFalse(os.path.exists(file_path))
        response = self.client.post(
            f'/api/topics/{topic.id}/documents/delete/',
            data=json.dumps({"filename": task_filename}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'deleted')
        self.assertFalse(os.path.exists(task_file_path))
        # 8. List empty again
        response = self.client.get(f'/api/topics/{topic.id}/documents/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])
