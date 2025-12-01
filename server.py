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

