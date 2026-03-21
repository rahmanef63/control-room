# vps-rahmanef

Control room untuk VPS dengan arsitektur tiga bagian:

- `frontend/` untuk dashboard UI yang dibuka di browser
- `agent/` untuk host agent yang jalan langsung di VPS dan punya akses ke Docker, systemd, logs, firewall, dan command execution
- `convex/` untuk realtime sync, command queue, audit log, dan state live

Alur data:

1. `agent/` membaca status host dan service dari VPS
2. data dikirim ke `convex/`
3. `frontend/` subscribe data live dari `convex/`
4. aksi dari UI dikirim ke `convex/`
5. `agent/` mengambil command, menjalankan di VPS, lalu mengirim hasilnya kembali

Catatan:

- `agent/` sebaiknya dijalankan sebagai `systemd service` langsung di host
- `frontend/` bisa dijalankan terpisah tanpa perlu akses langsung ke host internals
- `convex/` dipakai sebagai jalur sinkronisasi realtime dua arah

## Terminal access (CLI / lightweight TUI)

Repository ini sekarang punya package `cli/` dengan binary `vpsctl` untuk akses terminal ke command pipeline yang sama.

### Menjalankan CLI

```bash
cd /workspace/vps-rahmanef.com
npm install
npm --prefix cli install
CONVEX_URL=http://127.0.0.1:3210 CONVEX_ADMIN_KEY=... npm run cli:dev -- status
```

### Command yang tersedia

- `vpsctl status`
- `vpsctl apps list`
- `vpsctl agents list`
- `vpsctl events list --limit 20`
- `vpsctl commands list --limit 20`
- `vpsctl action run <action> --target-type <type> --target-id <id> [--wait]`
- `vpsctl tui --interval 3` (refreshing terminal dashboard)

Semua action yang dikirim lewat CLI memakai `requested_by=manual-cli` sehingga jejak audit tetap bisa dibedakan dari dashboard web.
