# VPS Control Room — PRD Quick Reference

Gunakan skill ini untuk mendapatkan konteks PRD tanpa membaca seluruh file 1400 baris. Jika butuh detail spesifik, baca section yang relevan dari `PRD.md`.

## Ringkasan Arsitektur

Tiga komponen: `frontend/` (Next.js 15), `agent/` (Node.js host process), `convex/` (self-hosted realtime DB).
Agent adalah satu-satunya yang boleh akses Docker, systemd, journalctl, fail2ban, ufw.

## 7 Convex Tables

1. **events** — timeline live, TTL 30 hari. Index: by_timestamp, by_type, by_severity.
2. **audit_log** — jejak permanen. Index: by_timestamp, by_target, by_action.
3. **agent_status** — upsert known agents. Index: by_name, by_status.
4. **system_snapshot** — host metrics, TTL 7 hari. Index: by_timestamp.
5. **alerts** — active/resolved. Index: by_status, by_severity.
6. **commands** — command queue. Index: by_status, by_request_id.
7. **app_status** — cache apps. Index: by_name, by_source, by_runtime_status.

## 5 Collectors (di agent/)

1. **system** — /proc/stat, /proc/meminfo, /proc/uptime, /proc/loadavg, /proc/net/dev, df
2. **docker** — Docker socket HTTP, containers, state, health, ports
3. **dokploy** — Dokploy API, app list, deploy info (fallback ke docker)
4. **agents** — ps aux, filter known list (openclaw-gateway, openclaw-nodes, codex, convex_realtime_daemon.py, ollama serve)
5. **security** — journalctl ssh, fail2ban-client, ufw, ss -tulpn

## Allowlist Actions v1

- `container.restart`, `container.stop`, `container.logs`
- `service.restart` (known services only)
- `dokploy.redeploy`
- `fail2ban.unban`

## 6 Dashboard Pages

Overview, Apps, Agents, Security, Events, Audit — plus Actions page dan Login.

## Phase Order

0: Repo foundation → 1: Frontend shell → 2: Convex core (paralel dgn 1) → 3: Agent collectors (butuh 2) → 4: UI binding (butuh 1+2) → 5: Action pipeline (butuh 3) → 6: Hardening → 7: Deploy → 8: Verify.

Untuk detail lengkap baca: `PRD.md` section yang relevan.
