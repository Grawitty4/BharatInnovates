#!/usr/bin/env python3
"""Quick test of server routing"""
import http.server
import socketserver
from urllib.parse import urlparse, unquote

class TestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        original = self.path
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        
        print(f"Request: {original}")
        print(f"  Parsed: {path}")
        
        if path == '/allapplications' or path == '/allapplications/':
            self.path = '/allapplications.html'
            print(f"  → Rewrite to: {self.path}")
        elif path.startswith('/allapplications/'):
            self.path = '/allapplications.html'
            print(f"  → Rewrite to: {self.path}")
        elif path == '/' or path == '':
            self.path = '/index.html'
            print(f"  → Rewrite to: {self.path}")
        
        return super().do_GET()

PORT = 8001
with socketserver.TCPServer(("", PORT), TestHandler) as httpd:
    print(f"Test server on port {PORT}")
    print("Access: http://localhost:8001/allapplications")
    print("Press Ctrl+C to stop")
    httpd.serve_forever()
