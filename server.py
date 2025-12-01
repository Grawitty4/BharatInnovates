#!/usr/bin/env python3
"""
Simple HTTP server to run the Application Review Portal locally.
"""

import http.server
import socketserver
import os
import webbrowser
from pathlib import Path

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers to allow local file access
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def log_message(self, format, *args):
        # Suppress default logging
        pass
    
    def do_GET(self):
        # Parse the URL
        from urllib.parse import urlparse, unquote
        import re
        import os
        
        original_path = self.path
        parsed_path = urlparse(self.path)
        path = unquote(parsed_path.path)
        
        # Don't rewrite static assets (JS, CSS, JSON, images, etc.)
        static_extensions = ['.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot']
        is_static_asset = any(path.lower().endswith(ext) for ext in static_extensions)
        
        if is_static_asset:
            # If static asset is under /allapplications/, rewrite to root
            # e.g., /allapplications/styles.css → /styles.css
            if path.startswith('/allapplications/'):
                # Extract the filename (everything after /allapplications/)
                filename = path.replace('/allapplications/', '/')
                self.path = filename
                print(f"Static asset rewrite: {original_path} → {self.path}")
            # Serve static assets directly
            return super().do_GET()
        
        # Handle clean URLs - rewrite to actual file paths
        # JavaScript will read the original pathname from window.location.pathname
        
        # Check if path is an ApplicationId (starts with BHAR-)
        application_id_pattern = re.compile(r'^/BHAR-[A-Z0-9]+$')
        
        if path == '/allapplications' or path == '/allapplications/':
            # Serve allapplications.html
            self.path = '/allapplications.html'
        elif path.startswith('/allapplications/'):
            # Handle /allapplications/ApplicationId
            # Just serve allapplications.html - JavaScript will extract ApplicationId from pathname
            self.path = '/allapplications.html'
        elif application_id_pattern.match(path):
            # Handle /BHAR-XXXXX on default page
            # Serve index.html - JavaScript will extract ApplicationId from pathname
            self.path = '/index.html'
        elif path == '/' or path == '':
            # Default to index.html
            self.path = '/index.html'
        
        # Debug: log the rewrite
        if original_path != self.path:
            print(f"URL rewrite: {original_path} → {self.path}")
            # Verify file exists
            file_to_serve = self.path.lstrip('/')
            if os.path.exists(file_to_serve):
                print(f"  ✓ File exists: {file_to_serve}")
            else:
                print(f"  ✗ File NOT found: {file_to_serve}")
                print(f"  Current directory: {os.getcwd()}")
        
        # Call parent handler
        try:
            return super().do_GET()
        except Exception as e:
            print(f"Error serving {self.path}: {e}")
            self.send_error(404, f"File not found: {self.path}")

def main():
    # Check if JSON file exists
    json_file = Path('Applications_1186_final_final.json')
    if not json_file.exists():
        print("⚠️  WARNING: Applications_1186_final_final.json not found!")
        print("   Please ensure the JSON file is in the same directory.")
        print()
    
    # Change to script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    Handler = MyHTTPRequestHandler
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 60)
        print("🚀 Bharat Innovates - Application Review Portal")
        print("=" * 60)
        print(f"\n✅ Server running at: {url}")
        print(f"\n📂 Serving files from: {os.getcwd()}")
        print("\n💡 Press Ctrl+C to stop the server")
        print("=" * 60)
        
        # Try to open browser automatically
        try:
            webbrowser.open(url)
            print("\n🌐 Opening browser...")
        except:
            print(f"\n🌐 Please open {url} in your browser")
        
        print()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 Server stopped. Goodbye!")

if __name__ == "__main__":
    main()

