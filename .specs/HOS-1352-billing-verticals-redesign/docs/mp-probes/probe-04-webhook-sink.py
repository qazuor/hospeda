#!/usr/bin/env python3
"""
=============================================================================
SONDA 04 — Receptor de webhooks
=============================================================================
NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
No se importa desde ningún lado, no participa de ningún build, no se deploya.

Programa: HOS-1352. Cubre las filas WH-1..WH-5 y EX-2 de la matriz.

Qué hace y qué NO hace:
  - Guarda cada POST entrante TAL CUAL llega: bytes crudos, todos los headers,
    la query string, y el instante de llegada con precisión de milisegundo.
  - NO interpreta el evento, NO lo normaliza, NO lo renombra, NO lo persiste
    en ningún modelo de dominio.

Eso último es el punto. Medir los webhooks a través del billing actual mostró
que la capa legacy RENOMBRA los eventos antes de que se los pueda ver: el
proveedor manda `subscription_authorized_payment` y el log lo llama
`invoice.updated`. El §58 exige medir al proveedor, no a nuestra
interpretación de él.

  python3 probe-04-webhook-sink.py [puerto]     # default 8787
=============================================================================
"""
import json
import os
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
OUT = os.environ.get("OUT_DIR", "/tmp/mp-webhooks")
os.makedirs(OUT, exist_ok=True)

LOG = os.path.join(OUT, "stream.jsonl")
seq = 0


class Sink(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _record(self, method: str) -> None:
        global seq
        seq += 1
        arrived = datetime.now(timezone.utc)
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""

        # Se guarda el cuerpo como texto crudo. Si además es JSON válido se
        # guarda parseado, pero el crudo manda: es lo que el proveedor mandó.
        body_text = raw.decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body_text) if body_text.strip() else None
        except json.JSONDecodeError:
            parsed = None

        entry = {
            "seq": seq,
            "arrived_at": arrived.isoformat(),
            "method": method,
            "path": self.path,
            "headers": dict(self.headers.items()),
            "body_raw": body_text,
            "body_parsed": parsed,
        }
        with open(LOG, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")

        # Una línea por evento en consola, para seguirlo en vivo.
        q = self.path.split("?", 1)[1] if "?" in self.path else ""
        sig = self.headers.get("x-signature", "")
        print(
            f"[{seq:03d}] {arrived.strftime('%H:%M:%S.%f')[:-3]} {method} {q[:90]}"
            f"{'  firma:si' if sig else '  firma:NO'}",
            flush=True,
        )

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"{}")

    def do_POST(self):  # noqa: N802
        self._record("POST")

    def do_GET(self):  # noqa: N802
        self._record("GET")

    def log_message(self, *_args):
        pass  # el log propio ya imprime lo que interesa


if __name__ == "__main__":
    print(f"receptor escuchando en :{PORT} · registro en {LOG}", flush=True)
    HTTPServer(("0.0.0.0", PORT), Sink).serve_forever()
