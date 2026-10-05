import unittest
from unittest.mock import AsyncMock, patch

import httpx
from starlette.requests import Request

import server


class RenderErrorLogTests(unittest.IsolatedAsyncioTestCase):
    async def run_job(self, responses):
        memory_db = server._InMemoryDB()
        await memory_db.renders.insert_one({'_id': 'render-test', 'status': 'queued'})
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.post.return_value = responses[0]
        client.get.side_effect = responses[1:]
        with patch.object(server, 'db', memory_db), patch.object(server.httpx, 'AsyncClient', return_value=client), patch.object(server.asyncio, 'sleep', new=AsyncMock()):
            await server._run_render_job('render-test', {'template': 'dreamwedds-royal-blush', 'category': 'DreamWedds'})
            page = await server.admin_error_logs(category='rendering', _=None)
        return memory_db, page['items'], client

    async def test_worker_failure_persisted_and_visible_in_admin_api(self):
        db, logs, client = await self.run_job([
            httpx.Response(200, json={'jobId': 'worker-test'}),
            httpx.Response(200, json={'status': 'failed', 'progress': .25, 'error': 'Image failed',
                                     'errorDetails': {'stage': 'render_media', 'stack': 'Error: Image failed\n at render'}}),
        ])
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0]['source'], 'render-service')
        self.assertEqual(logs[0]['context']['stage'], 'render_media')
        self.assertEqual(logs[0]['context']['jobId'], 'worker-test')
        self.assertIn('at render', logs[0]['context']['stack'])
        self.assertEqual(logs[0]['context']['progress'], .25)
        self.assertEqual(logs[0]['context']['template'], 'dreamwedds-royal-blush')
        self.assertEqual((await db.renders.find_one({'_id': 'render-test'}))['status'], 'failed')
        self.assertEqual(client.post.call_args.kwargs['headers']['X-Render-Id'], 'render-test')

    async def test_unhandled_server_exception_visible_in_admin_api(self):
        memory_db = server._InMemoryDB()
        request = Request({"type": "http", "method": "GET", "path": "/api/example", "headers": []})
        with patch.object(server, 'db', memory_db):
            try:
                raise RuntimeError('Server failure')
            except RuntimeError as exc:
                response = await server.log_unhandled_exception(request, exc)
            page = await server.admin_error_logs(category='unhandled', _=None)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(page['items'][0]['source'], 'backend')
        self.assertEqual(page['items'][0]['path'], '/api/example')
        self.assertIn('RuntimeError: Server failure', page['items'][0]['context']['stack'])

    async def test_dispatch_rejection_logged(self):
        _, logs, _ = await self.run_job([httpx.Response(400, text='Invalid fields')])
        self.assertEqual(logs[0]['statusCode'], 400)
        self.assertEqual(logs[0]['context']['stage'], 'dispatch')
        self.assertEqual(logs[0]['detail'], 'Invalid fields')

    async def test_download_failure_logged(self):
        _, logs, _ = await self.run_job([
            httpx.Response(200, json={'jobId': 'worker-test'}),
            httpx.Response(200, json={'status': 'done', 'progress': 1}),
            httpx.Response(500, text='File unavailable'),
        ])
        self.assertEqual(logs[0]['context']['stage'], 'download')
        self.assertEqual(logs[0]['statusCode'], 500)

    async def test_backend_exception_persists_stack_trace(self):
        _, logs, _ = await self.run_job([httpx.Response(200, json={})])
        self.assertEqual(logs[0]['source'], 'backend')
        self.assertEqual(logs[0]['context']['stage'], 'dispatch')
        self.assertIn('KeyError', logs[0]['context']['stack'])

    async def test_poll_failure_recorded_once_per_outage(self):
        _, logs, _ = await self.run_job([
            httpx.Response(200, json={'jobId': 'worker-test'}),
            httpx.Response(503, text='Unavailable'), httpx.Response(503, text='Unavailable'),
            httpx.Response(200, json={'status': 'failed', 'error': 'Worker stopped'}),
        ])
        self.assertEqual(len(logs), 2)
        self.assertEqual(sum(log['severity'] == 'warning' for log in logs), 1)


if __name__ == '__main__':
    unittest.main()
