"""
Servidor web minimo para o YTALSEG Apontamento (versao nuvem).
Usa apenas a biblioteca padrao do Python (http.server) - nao precisa
instalar nada. Serve os arquivos da pasta static/ e abre o index.html na raiz.
"""
import os
import http.server
import socketserver

PORT = int(os.environ.get("PORT", "8000"))
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_GET(self):
        if self.path in ("/", ""):
            self.path = "/index.html"
        return super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()


class Server(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with Server(("0.0.0.0", PORT), Handler) as httpd:
        print(f"YTALSEG Apontamento Web rodando na porta {PORT}")
        httpd.serve_forever()
