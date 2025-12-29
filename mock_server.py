#!/usr/bin/env python3
"""Simple local mock server for testing frontend HTTP paths.
Run: python mock_server.py
Endpoints:
 - GET /state -> returns current state JSON
 - POST /state -> accepts partial state JSON, merges it, returns {ok:true}
 - POST /wifi -> accepts {ssid, pass} and responds {ok:true, ip: '127.0.0.1:8000'}
 - GET /health -> returns {ok:true}
"""
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

state = {
    "mode": "solid",
    "solid_color": [255,230,0],
    "solid_bright": 0.8,
}

class Handler(BaseHTTPRequestHandler):
    def _send(self, code, data, content_type='application/json'):
        body = json.dumps(data)
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body.encode())

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/state':
            self._send(200, state)
        elif path == '/health':
            self._send(200, {'ok': True})
        else:
            self._send(404, {'error':'not found'})

    def do_POST(self):
        path = urlparse(self.path).path
        length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(length) if length else b''
        try:
            data = json.loads(raw.decode()) if raw else {}
        except Exception:
            data = {}
        if path == '/state':
            for k in data:
                state[k] = data[k]
            self._send(200, {'ok': True})
        elif path == '/wifi':
            ssid = data.get('ssid'); passwd = data.get('pass') or data.get('password')
            # Simulate success
            self._send(200, {'ok': True, 'ip': '127.0.0.1:8000'})
        else:
            self._send(404, {'error':'not found'})

if __name__ == '__main__':
    port = 8000
    print(f"Mock server running at http://localhost:{port}/")
    HTTPServer(('0.0.0.0', port), Handler).serve_forever()
