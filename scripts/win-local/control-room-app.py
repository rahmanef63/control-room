#!/usr/bin/env python3
"""
VPS Control Room — native desktop launcher (Windows, local).

Opens the dashboard in a lightweight native WebView2 window instead of a full
browser, to save RAM. Python orchestrates everything:
  1. start the agent (:4001) and frontend (:4000) if they aren't running,
  2. wait until the dashboard answers,
  3. open a chromeless native window pointed at it.

Renderer preference: pywebview (EdgeChromium/WebView2). If pywebview can't load,
falls back to Edge in --app mode (same WebView2 engine, still chromeless).

Run normally (via the desktop shortcut) to open the window.
Run `py control-room-app.py --selftest` to verify servers without a window.
"""
from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

# --- Paths & config ---------------------------------------------------------
HERE = Path(__file__).resolve().parent           # scripts/win-local
REPO = HERE.parent.parent                         # repo root
ICON = HERE / "control-room.ico"
START_AGENT = HERE / "start-agent.ps1"
START_FRONTEND = HERE / "start-frontend.ps1"

FRONTEND_PORT = int(os.environ.get("CONTROL_ROOM_PORT", "4000"))
AGENT_PORT = int(os.environ.get("AGENT_HEALTH_PORT", "4001"))
URL = f"http://localhost:{FRONTEND_PORT}"
TITLE = "VPS Control Room"
WAIT_TIMEOUT_S = 120


def port_up(port: int) -> bool:
    """True if something is listening on 127.0.0.1:<port>."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex(("127.0.0.1", port)) == 0


def start_server(script: Path) -> None:
    """Launch a server .ps1 in its own minimized window (logs visible, survives)."""
    # Mirror start-control-room.ps1: Start-Process … -WindowStyle Minimized -NoExit.
    inner = (
        "Start-Process powershell -WindowStyle Minimized -ArgumentList "
        f"'-NoExit','-ExecutionPolicy','Bypass','-File','{script}'"
    )
    subprocess.Popen(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", inner],
        cwd=str(REPO),
    )


def ensure_servers() -> None:
    if not port_up(AGENT_PORT):
        print(f"[launcher] starting agent (:{AGENT_PORT}) …")
        start_server(START_AGENT)
    else:
        print(f"[launcher] agent already up (:{AGENT_PORT})")
    if not port_up(FRONTEND_PORT):
        print(f"[launcher] starting frontend (:{FRONTEND_PORT}) …")
        start_server(START_FRONTEND)
    else:
        print(f"[launcher] frontend already up (:{FRONTEND_PORT})")


def wait_until_ready(timeout_s: int = WAIT_TIMEOUT_S) -> bool:
    """Poll the login page until it answers (first dev compile can take a while)."""
    deadline = time.monotonic() + timeout_s
    last = ""
    while time.monotonic() < deadline:
        try:
            req = urllib.request.Request(f"{URL}/login", method="GET")
            with urllib.request.urlopen(req, timeout=3) as r:
                if r.status < 500:
                    print(f"[launcher] dashboard ready (HTTP {r.status})")
                    return True
                last = f"HTTP {r.status}"
        except Exception as e:  # noqa: BLE001 - connection refused while booting
            last = type(e).__name__
        time.sleep(1.0)
    print(f"[launcher] timed out waiting for {URL} (last: {last})")
    return False


def open_edge_app(url: str) -> None:
    """Fallback: chromeless Edge --app window (same WebView2 engine)."""
    candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    edge = next((p for p in candidates if os.path.exists(p)), None)
    if not edge:
        print("[launcher] Edge not found; open manually:", url)
        return
    udd = os.path.join(os.environ.get("LOCALAPPDATA", str(REPO)), "ControlRoomApp")
    print("[launcher] opening Edge --app window")
    subprocess.Popen([edge, f"--app={url}", f"--user-data-dir={udd}", "--window-size=1320,880"])


def open_window(url: str) -> None:
    """Preferred: pywebview native window. Falls back to Edge --app on failure."""
    try:
        import webview  # type: ignore
    except Exception as e:  # noqa: BLE001
        print("[launcher] pywebview unavailable:", e)
        return open_edge_app(url)
    try:
        webview.create_window(TITLE, url, width=1320, height=880, min_size=(900, 600))
        try:
            webview.start(icon=str(ICON))  # icon kwarg on pywebview >= 4
        except TypeError:
            webview.start()
    except Exception as e:  # noqa: BLE001 - e.g. no WebView2 backend
        print("[launcher] pywebview failed, falling back to Edge --app:", e)
        open_edge_app(url)


def main() -> int:
    selftest = "--selftest" in sys.argv
    ensure_servers()
    ready = wait_until_ready()
    if selftest:
        print("SELFTEST:", "PASS" if ready else "FAIL")
        return 0 if ready else 1
    if not ready:
        print("[launcher] servers did not come up in time; opening window anyway")
    open_window(URL)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
