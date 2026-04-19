import http.server
import json
import time
from threading import Thread


class MockAetherAPI(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200, "OK")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers", "X-Requested-With, Content-Type"
        )
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()

    def do_GET(self):
        print(f"DEBUG: Handling GET request for {self.path}")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()

        if self.path == "/health":
            response = {"status": "ok", "demo_mode": True, "database": "mocked"}
        elif self.path == "/api/telemetry/aircraft":
            response = [
                {
                    "icao24": "A1B2C3",
                    "callsign": "AETHER1",
                    "position": [56.32, 26.54],
                    "altitude_m": 10500,
                    "velocity_ms": 240,
                    "track": 120,
                    "threat_level": "LOW",
                    "detected_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                },
                {
                    "icao24": "X9Y8Z7",
                    "callsign": "ANOMALY1",
                    "position": [56.88, 26.12],
                    "altitude_m": 8200,
                    "velocity_ms": 310,
                    "track": 245,
                    "threat_level": "CRITICAL",
                    "detected_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                },
            ]
        elif self.path == "/api/telemetry/vessels":
            response = [
                {
                    "mmsi": "123456789",
                    "ship_name": "SC SCOUT",
                    "position": [56.45, 26.34],
                    "speed_knots": 12.5,
                    "course": 90,
                    "threat_level": "MEDIUM",
                    "detected_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }
            ]
        else:
            response = {"error": "Not Found"}

        self.wfile.write(json.dumps(response).encode("utf-8"))

    def do_POST(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        response = {"ok": True}
        self.wfile.write(json.dumps(response).encode("utf-8"))


def run_server():
    server_address = ("", 8080)
    httpd = http.server.HTTPServer(server_address, MockAetherAPI)
    print("Mock Aether API running on port 8080...")
    httpd.serve_forever()


if __name__ == "__main__":
    run_server()
