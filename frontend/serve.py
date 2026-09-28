"""Static dev server for the frontend.

Why this file exists:

1. The FastAPI backend only allows CORS requests from
   http://localhost:5173 and http://127.0.0.1:5173
   (see backend/app/main.py). The backend is not modified, so the frontend
   has to be served from port 5173.
2. The app uses real URL routing (History API), so a request for a deep link
   such as /tickets/15 must return index.html instead of a 404.

Run it with:

    python frontend/serve.py

Then open http://localhost:5173
"""

import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 5173
HOST = "127.0.0.1"
ROOT = os.path.dirname(os.path.abspath(__file__))
INDEX_FILE = os.path.join(ROOT, "index.html")


class SpaRequestHandler(SimpleHTTPRequestHandler):
    """Serves real files, and index.html for every other path (SPA routing)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Never cache during development, otherwise edited files keep the old version.
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def do_GET(self):
        target = self.translate_path(self.path)

        if os.path.isdir(target):
            inner_index = os.path.join(target, "index.html")
            if os.path.isfile(inner_index):
                return super().do_GET()
            return self.send_index()

        if os.path.isfile(target):
            return super().do_GET()

        # A missing image, script or stylesheet must stay a 404. Returning
        # index.html for those would send HTML to the browser as JavaScript.
        if self.is_asset_request():
            self.send_error(404, "File not found")
            return

        # Any other unknown path is a client side route: let the router handle it.
        return self.send_index()

    def is_asset_request(self):
        path = self.path.split("?")[0]
        return os.path.splitext(path)[1] != ""

    def send_index(self):
        try:
            with open(INDEX_FILE, "rb") as handle:
                body = handle.read()
        except OSError:
            self.send_error(500, "index.html is missing")
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stderr.write("[frontend] %s\n" % (fmt % args))


def main():
    if not os.path.isfile(INDEX_FILE):
        print("Error: %s not found." % INDEX_FILE)
        return 1

    try:
        server = ThreadingHTTPServer((HOST, PORT), SpaRequestHandler)
    except OSError as error:
        print("Could not start the frontend on port %d: %s" % (PORT, error))
        print("Stop whatever is already using that port, then try again.")
        return 1

    print("Frontend running on http://%s:%d" % (HOST, PORT))
    print("Backend API expected on http://localhost:8000")
    print("Press Ctrl+C to stop.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nFrontend server stopped.")
    finally:
        server.server_close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
