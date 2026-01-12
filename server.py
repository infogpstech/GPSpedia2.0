import http.server
import socketserver

PORT = 8000

class MyHttpRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.path.endswith('.js'):
            self.send_header('Content-type', 'application/javascript')
        super().end_headers()

Handler = MyHttpRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    # Allow address reuse
    httpd.allow_reuse_address = True
    print("serving at port", PORT)
    httpd.serve_forever()
