# PRD: VPS Control Room

Status: Draft siap implementasi  
Project slug: `vps-control-room`  
Repository: `git@github.com:rahmanef63/vps-rahmanef.com.git`  
Canonical local path: `/home/rahman/projects/vps-rahmanef`  
Primary domain: `vps.rahmanef.com`  
Access mode: `Tailscale only`  
Target host: `Ubuntu 24.04.4 LTS`, `8 vCPU`, `31 GiB RAM`, `Node.js v22.22.1`

## 1. Ringkasan

VPS Control Room adalah dashboard web dua arah untuk satu VPS yang dipakai menjalankan banyak aplikasi, container, dan agent. Dashboard ini bukan hanya monitoring. Dashboard ini juga menjadi control plane ringan untuk:

- memantau kesehatan host VPS
- memantau aplikasi yang dikelola Dokploy dan container lain yang hidup di host
- memantau agent yang berjalan di host
- menjalankan aksi aman yang sudah di-allowlist
- mencatat seluruh aksi dan perubahan ke audit log

Sistem harus tetap bisa dipakai walau Dokploy bermasalah. Karena itu dashboard inti tidak boleh bergantung pada container Dokploy untuk hidup.

## 2. Tujuan Produk

### 2.1 Tujuan utama

- Memberi visibilitas visual real-time terhadap kondisi VPS untuk user non-infra.
- Menyatukan status host, app, container, security, dan agent ke satu UI.
- Menyediakan aksi operasional aman dari UI tanpa perlu SSH manual untuk tugas umum.
- Menjaga jejak audit semua aksi yang dipicu dari dashboard.
- Menjadi fondasi orchestration panel untuk server yang dipakai banyak agent.

### 2.2 Hasil yang diinginkan

- User bisa memahami status VPS dalam waktu kurang dari 15 detik setelah membuka dashboard.
- User bisa melihat app mana yang sehat atau bermasalah tanpa membuka terminal.
- User bisa restart service/app tertentu dari UI dengan aman.
- User bisa melihat event penting yang baru terjadi dalam timeline live.
- User bisa mengetahui jika ada port baru yang terbuka, app mati, agent mati, atau brute-force SSH.

### 2.3 Non-goals v1

- Tidak menyediakan shell interaktif dari browser.
- Tidak mengedit firewall rules dari UI.
- Tidak mengedit file arbitrary di host dari UI.
- Tidak menyediakan multi-user RBAC kompleks.
- Tidak menjadi pengganti penuh Dokploy.
- Tidak melakukan auto-remediation kompleks di v1.

## 3. User dan Use Case

### 3.1 Primary user

- Abdurrahman Fakhrul

### 3.2 Profil user

- Mengelola VPS yang menjalankan banyak app dan automation.
- Butuh visibilitas visual.
- Tidak ingin terlalu bergantung pada terminal untuk observasi harian.
- Tetap butuh kontrol dua arah untuk aksi operasional penting.

### 3.3 Use case utama

- Melihat kesehatan host: CPU, RAM, disk, uptime, network.
- Melihat apakah app Dokploy sedang sehat, down, atau crash.
- Melihat agent yang sedang hidup dan apa yang sedang mereka lakukan.
- Melihat event keamanan seperti login SSH gagal, IP diblokir fail2ban, port baru terbuka.
- Restart container/service dengan satu klik.
- Melihat log singkat ketika ada masalah.
- Melihat riwayat aksi yang pernah dilakukan dari dashboard.

## 4. Prinsip Desain

- `Host-first`: komponen yang butuh akses VPS harus berjalan di host, bukan di browser.
- `Survive Dokploy crash`: panel inti harus tetap hidup walau Dokploy atau app lain gagal.
- `Read first, act second`: UI menonjolkan observability lebih dulu, action kedua.
- `Allowlist only`: command yang bisa dijalankan harus eksplisit, bukan shell bebas.
- `Tailscale only`: dashboard tidak dibuka ke internet publik.
- `Single user`: auth sederhana dan ketat, tidak perlu sistem user management kompleks di v1.
- `Auditable`: semua aksi penting harus masuk audit log.
- `Portable`: clone repo, isi env, install dependency, enable systemd, lalu jalan.

## 5. Keputusan Arsitektur

## 5.1 Struktur logis

Monorepo ini punya tiga bagian:

- `frontend/`: aplikasi Next.js untuk UI dashboard
- `agent/`: host agent yang berjalan langsung di VPS dan punya akses ke sistem
- `convex/`: schema, function, dan data layer untuk realtime sync, event, audit log, alert, dan state

## 5.2 Kenapa tidak ada `backend/` HTTP biasa

Dashboard browser tidak bisa membaca Docker, systemd, log host, fail2ban, atau file host secara langsung. Karena itu, lapisan yang berinteraksi dengan sistem operasi harus menjadi host agent, bukan backend app biasa yang diasumsikan jalan seperti web app normal.

Istilah yang benar untuk sistem ini:

- UI: `frontend`
- kontrol host: `agent`
- data sync dan event bus: `convex`

## 5.3 Data flow

1. `agent` melakukan polling dan streaming terhadap data host.
2. `agent` mengirim snapshot, status, event, dan alert ke `convex`.
3. `frontend` subscribe ke data live dari `convex`.
4. User memicu action dari `frontend`.
5. Action masuk ke `convex` sebagai command record.
6. `agent` mengambil command yang pending, melakukan validasi allowlist, lalu mengeksekusi.
7. `agent` mengirim hasil eksekusi ke `convex`.
8. `frontend` menampilkan hasil action dan audit secara live.

## 5.4 Runtime placement

- `frontend`:
  berjalan sebagai Next.js app lokal di host lewat `systemd`
- `agent`:
  berjalan sebagai process lokal di host lewat `systemd`
- `convex`:
  memakai instance self-hosted yang sudah ada di VPS

Catatan penting:

- `frontend` tidak perlu akses root atau Docker socket.
- `agent` adalah satu-satunya komponen yang boleh berinteraksi dengan Docker socket, `systemctl`, `journalctl`, `fail2ban-client`, `ufw`, `iptables`, dan collector host lainnya.

## 6. Tech Stack

| Layer | Teknologi |
|---|---|
| UI framework | Next.js 15 App Router |
| Styling | Tailwind CSS |
| Component library | shadcn/ui |
| State live UI | Convex subscriptions untuk data utama, SSE opsional hanya untuk stream log |
| Host integration | Node.js 22 + allowlisted `child_process` + Docker socket HTTP |
| Data layer | Convex self-hosted |
| Auth | single shared secret via env + signed session cookie |
| Process manager | systemd |
| Host OS | Ubuntu 24.04.4 LTS |

## 6.1 Catatan koreksi terhadap draft awal

- Jangan jadikan SSE sebagai tulang punggung utama seluruh state. Lebih stabil memakai Convex untuk state live dan SSE hanya untuk stream log jika perlu.
- Jangan taruh collector penuh di route handler Next.js. Collector dan executor harus berada di `agent`.
- Jangan memakai `server.js` generik sebagai asumsi default Next.js. Gunakan build/start yang sesuai.
- `WantedBy` systemd yang benar adalah `multi-user.target`, bukan `multi-user.instance`.
- `CONVEX_URL=http://localhost:6791` salah untuk backend API jika `6791` adalah dashboard. URL dan deployment env untuk Convex harus memakai endpoint backend yang benar pada instance yang sudah berjalan.

## 7. Functional Requirements

## 7.1 Overview

Dashboard overview harus menampilkan:

- CPU total
- CPU per core
- RAM used / available / total
- Disk usage per mount penting
- Uptime VPS
- Network in/out
- jumlah container running / stopped / unhealthy
- jumlah app Dokploy sehat / error
- jumlah agent aktif
- jumlah alert aktif
- quick status badge untuk layanan inti

Quick status badge minimal:

- Dokploy
- Convex
- n8n
- Ollama
- SSH
- Fail2ban

Refresh target:

- host snapshot: 5 detik
- badge status: 5 sampai 10 detik

## 7.2 Apps & Services

Sumber data:

- Docker socket
- Dokploy API
- optional health check HTTP

Panel harus menampilkan per app:

- nama app
- source type: Dokploy app, standalone container, infra service
- status runtime
- health status
- port internal
- port publish publik jika ada
- domain terkait
- last deploy time jika tersedia
- restart count jika tersedia
- last known error jika ada

Action minimal v1:

- restart app/container
- view logs
- refresh app status

Sensitive action:

- redeploy app via Dokploy API
- stop container

Tiap action sensitif wajib punya:

- modal konfirmasi
- target yang jelas
- audit log entry

Apps target awal yang harus dikenali:

- `azzahrah-site`
- `brutalism-website`
- `designs`
- `franchise-rocker-chicken`
- `ggrahmanef-com`
- `lebaran-shop`
- `openclaw-dashboard-manef`
- `rahmanef-com`
- `superspace-apps`
- `superspace-mobile`
- `test-template-app`

Infra services yang juga harus terlihat:

- `dokploy`
- `dokploy-postgres`
- `dokploy-redis`
- `dokploy-traefik`
- `n8n`
- container Convex self-hosted yang terpublish

## 7.3 Agents

Panel agents harus memantau proses dan runtime berikut:

- `openclaw-gateway`
- `openclaw-nodes`
- `codex`
- `convex_realtime_daemon.py`
- `ollama serve`

Per agent tampilkan:

- nama
- source deteksi
- PID
- uptime
- CPU usage
- memory usage
- last_seen
- status
- host action yang tersedia

Deteksi awal:

- `openclaw-gateway`: berdasarkan nama proses dan/atau container
- `openclaw-nodes`: berdasarkan nama proses
- `codex`: berdasarkan nama proses
- `convex_realtime_daemon.py`: berdasarkan nama proses atau script path
- `ollama serve`: berdasarkan nama proses/service

Action agent v1:

- restart service/container jika aman dan path restart jelas
- kill process untuk target yang memang diizinkan

Action `kill PID` tidak boleh generik. Harus map ke target yang dikenali, bukan ke PID arbitrary dari user.

## 7.4 Security

Panel security harus menampilkan:

- login SSH sukses terbaru
- login SSH gagal terbaru
- status fail2ban
- jail aktif
- total banned IP
- daftar IP banned terbaru
- UFW rules ringkas
- port publik yang listen
- port Docker yang dipublish langsung
- peringatan jika ada port baru yang tidak ada di allowlist known ports
- status root login policy
- status password auth SSH

Known ports awal yang boleh dikenali:

- `22`, `2221` untuk SSH
- `80`, `443` untuk reverse proxy
- `3000` untuk Dokploy
- port internal aplikasi yang memang disetujui

Harus ada warning khusus jika ditemukan:

- Docker membuka port yang tidak ada di daftar dikenal
- port terpublish yang mem-bypass UFW
- fail2ban tidak menghitung log SSH
- ada service desktop/RDP aktif di VPS

## 7.5 Events Timeline

Timeline harus append-only dan live.

Source event:

- host snapshot anomaly
- container lifecycle
- app action result
- agent action result
- security event
- manual action dari dashboard

Contoh event:

```text
[10:05:32] action.success container.restart superspace-apps manual-dashboard
[10:03:11] alert.warning cpu.spike host-monitor
[10:01:44] alert.error container.stopped test-template-app
[09:58:20] security.ban fail2ban sshd 192.168.x.x
[09:55:01] agent.info openclaw-nodes task.completed
```

## 7.6 Actions

### Safe actions

- restart container yang dikenali
- restart service yang dikenali
- refresh app status
- fetch logs read-only

### Sensitive actions

- redeploy via Dokploy API
- stop container yang dikenali
- unban IP fail2ban
- restart systemd service yang dikenali

### Explicitly forbidden from UI v1

- shell arbitrary
- command arbitrary
- edit file arbitrary
- edit firewall rules
- run sudo arbitrary
- browse filesystem arbitrary

## 7.7 Audit Log

Semua action dari UI atau agent harus masuk audit log.

Kolom minimal:

- `timestamp`
- `actor`
- `action`
- `target`
- `result`
- `severity`
- `metadata`

Contoh actor:

- `manual-dashboard`
- `system-agent`
- `scheduled-check`

Audit log harus immutable dari sisi UI v1. Tidak ada delete/edit.

## 8. Non-Functional Requirements

## 8.1 Availability

- Frontend dan agent harus auto-restart via systemd.
- Dashboard tetap bisa dibuka walau Dokploy mati.
- Error satu collector tidak boleh membuat seluruh panel gagal.

## 8.2 Performance

- Overview initial load < 3 detik di jaringan Tailscale normal.
- Polling host tidak boleh membuat CPU overhead tinggi.
- Semua collector yang mahal harus punya interval, bukan loop agresif.

## 8.3 Security

- Dashboard hanya bind ke host/Tailscale sesuai konfigurasi.
- Semua route action harus butuh auth.
- Semua action harus tervalidasi terhadap allowlist.
- Secret tidak boleh dikirim ke client.
- Docker socket hanya boleh diakses oleh `agent`.

## 8.4 Operability

- Ada health endpoint untuk frontend dan agent.
- Ada log systemd yang mudah dibaca.
- Env config harus ringkas dan terdokumentasi.

## 9. Data Sources dan Collector Design

Collector berjalan di `agent`, bukan di route Next.js.

## 9.1 System collector

Source:

- `/proc/stat`
- `/proc/meminfo`
- `/proc/uptime`
- `/proc/net/dev`
- `df -h` atau pembacaan filesystem yang lebih stabil

Output:

- CPU total
- CPU per core
- RAM
- disk per mount
- uptime
- network in/out

Interval:

- 5 detik

## 9.2 Docker collector

Source:

- Docker socket `/var/run/docker.sock`

Output:

- daftar container
- state
- health
- published ports
- restart count jika tersedia
- log tail ringkas on-demand

Interval:

- 5 sampai 10 detik untuk summary
- on-demand untuk log

## 9.3 Dokploy collector

Source:

- Dokploy API lokal

Output:

- daftar app
- deploy info
- service list
- redeploy/restart actions

Catatan:

- jika Dokploy API tidak cukup untuk suatu data, Docker collector tetap jadi fallback.

## 9.4 Agent/process collector

Source:

- `ps`
- `systemctl`
- optional pidfile bila ada

Output:

- status agent known list
- PID
- CPU/RAM
- uptime

Interval:

- 5 detik

## 9.5 Security collector

Source:

- `journalctl -u ssh.service`
- `fail2ban-client`
- `ufw status verbose`
- `iptables -S`
- `ss -tulpn`

Catatan penting:

- Untuk Ubuntu 24.04 di host ini, log SSH lebih aman diambil dari `journalctl`, bukan mengandalkan `/var/log/auth.log`.
- Security collector harus bisa mendeteksi perbedaan antara rule `ufw` dan exposure aktual dari Docker via iptables.

## 10. Command Execution Model

Semua command dijalankan oleh `agent`.

## 10.1 Allowlist actions v1

- `docker container restart <known-container>`
- `docker logs --tail N <known-container>`
- `systemctl restart <known-service>`
- `fail2ban-client set sshd unbanip <ip>`
- request redeploy ke Dokploy API untuk app yang dikenali

## 10.2 Validation rules

- User tidak boleh mengirim command raw.
- Target harus berasal dari daftar known target yang sudah ditemukan collector.
- Semua action harus melewati validator target type.
- Semua action harus punya `request_id`.

## 10.3 Execution result

Result minimal:

- `queued`
- `running`
- `success`
- `failed`
- `cancelled`

## 11. Convex Data Model

Berikut tabel minimum. Semua tabel harus mendefinisikan index di `schema.ts`.

Package manager: **npm** (konsisten di seluruh monorepo).

### `events`

Tujuan:

- timeline live
- TTL 30 hari (dibersihkan oleh scheduled function Convex, lihat section 11.1)

Kolom:

- `timestamp` (number, epoch ms)
- `type` (string)
- `message` (string)
- `severity` (string: `info` | `warning` | `error` | `critical`)
- `source` (string)
- `target` (string, optional)
- `metadata` (object, optional)

Index:

- `by_timestamp`: [`timestamp`]
- `by_type`: [`type`, `timestamp`]
- `by_severity`: [`severity`, `timestamp`]

### `audit_log`

Tujuan:

- jejak permanen semua action

Kolom:

- `timestamp` (number, epoch ms)
- `action` (string)
- `target` (string)
- `result` (string: `success` | `failed` | `cancelled`)
- `severity` (string: `info` | `warning` | `critical`)
- `triggered_by` (string: `manual-dashboard` | `system-agent` | `scheduled-check`)
- `request_id` (string)
- `metadata` (object, optional)

Index:

- `by_timestamp`: [`timestamp`]
- `by_target`: [`target`, `timestamp`]
- `by_action`: [`action`, `timestamp`]

### `agent_status`

Tujuan:

- upsert status agent known list

Kolom:

- `name` (string)
- `pid` (number, optional — null jika tidak ditemukan)
- `status` (string: `running` | `stopped` | `unknown`)
- `cpu` (number, persentase)
- `memory` (number, bytes)
- `uptime_seconds` (number)
- `last_seen` (number, epoch ms)
- `detection_source` (string: `process` | `container` | `systemd` | `pidfile`)
- `available_actions` (array of string: action yang bisa dilakukan terhadap agent ini)
- `metadata` (object, optional)

Index:

- `by_name`: [`name`]
- `by_status`: [`status`]

### `system_snapshot`

Tujuan:

- snapshot berkala host
- TTL 7 hari (dibersihkan oleh scheduled function Convex, lihat section 11.1)

Kolom:

- `timestamp` (number, epoch ms)
- `cpu_total` (number, persentase)
- `cpu_cores` (array of number)
- `ram_total` (number, bytes)
- `ram_used` (number, bytes)
- `ram_available` (number, bytes)
- `disk` (array of object: `{ mount: string, total: number, used: number, available: number }`)
- `network` (object: `{ rx_bytes: number, tx_bytes: number, rx_rate: number, tx_rate: number }`)
- `uptime_seconds` (number)
- `load_average` (array of number: 1m, 5m, 15m)

Index:

- `by_timestamp`: [`timestamp`]

### `alerts`

Tujuan:

- alert aktif dan resolved state

Kolom:

- `type` (string)
- `message` (string)
- `severity` (string: `warning` | `error` | `critical`)
- `status` (string: `active` | `resolved` | `acknowledged`)
- `created_at` (number, epoch ms)
- `resolved_at` (number, epoch ms, optional)
- `metadata` (object, optional)

Index:

- `by_status`: [`status`, `created_at`]
- `by_severity`: [`severity`, `created_at`]

### `commands`

Tujuan:

- command queue dua arah frontend ke agent

Kolom:

- `request_id` (string, UUID)
- `action` (string)
- `target_type` (string: `container` | `service` | `agent` | `dokploy-app` | `fail2ban`)
- `target_id` (string)
- `payload` (object, optional)
- `status` (string: `queued` | `running` | `success` | `failed` | `cancelled` | `timeout`)
- `requested_by` (string)
- `requested_at` (number, epoch ms)
- `started_at` (number, epoch ms, optional)
- `finished_at` (number, epoch ms, optional)
- `result` (string, optional)
- `error` (string, optional)

Index:

- `by_status`: [`status`, `requested_at`]
- `by_request_id`: [`request_id`]

### `app_status`

Tujuan:

- cache status apps/service yang ditampilkan UI

Kolom:

- `name` (string)
- `source` (string: `dokploy` | `docker` | `systemd`)
- `runtime_status` (string: `running` | `stopped` | `restarting` | `error` | `unknown`)
- `health_status` (string: `healthy` | `unhealthy` | `none` | `unknown`)
- `ports` (array of object: `{ internal: number, published: number | null, protocol: string }`)
- `domain` (string, optional)
- `last_seen` (number, epoch ms)
- `restart_count` (number, optional)
- `last_deploy_time` (number, epoch ms, optional)
- `last_known_error` (string, optional)
- `metadata` (object, optional)

Index:

- `by_name`: [`name`]
- `by_source`: [`source`]
- `by_runtime_status`: [`runtime_status`]

## 11.1 TTL Cleanup

Implementasi TTL menggunakan Convex scheduled function (cron):

- Setiap **1 jam**, jalankan function yang menghapus dokumen `events` yang lebih tua dari 30 hari.
- Setiap **1 jam**, jalankan function yang menghapus dokumen `system_snapshot` yang lebih tua dari 7 hari.
- Function cleanup harus batch delete (maks 100 dokumen per eksekusi) untuk menghindari timeout.
- Buat file `convex/crons.ts` untuk mendefinisikan jadwal ini.

## 12. UI / Route Structure

Frontend berada di `frontend/` dan menggunakan App Router.

Struktur minimal:

```text
frontend/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx            # dashboard layout dengan sidebar
│   │   ├── page.tsx              # overview
│   │   ├── apps/page.tsx
│   │   ├── agents/page.tsx
│   │   ├── security/page.tsx
│   │   ├── events/page.tsx
│   │   ├── actions/page.tsx
│   │   └── audit/page.tsx
│   ├── login/page.tsx
│   └── api/
│       ├── auth/login/route.ts   # POST login
│       ├── auth/logout/route.ts  # POST logout
│       └── health/route.ts       # GET health check
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── MetricCard.tsx
│   ├── StatusBadge.tsx
│   ├── AppTable.tsx
│   ├── AgentTable.tsx
│   ├── SecurityPanel.tsx
│   ├── EventTimeline.tsx
│   ├── AuditTable.tsx
│   ├── ConfirmActionDialog.tsx
│   └── ConnectionStatus.tsx      # indicator koneksi Convex
├── lib/
│   ├── auth.ts                   # session cookie sign/verify helpers
│   ├── convex.ts                 # Convex client provider
│   └── types.ts                  # shared UI types
├── middleware.ts                  # auth guard — redirect ke /login jika cookie invalid
└── package.json
```

Catatan:

- Route action utama tidak perlu mengeksekusi host command langsung.
- Frontend menulis command ke Convex atau memanggil endpoint internal tipis yang meneruskan request ke Convex.
- Log streaming **tidak lewat Next.js route handler**. Agent menulis log tail ke Convex on-demand, dan frontend subscribe ke data tersebut. Jika perlu streaming panjang di masa depan, tambahkan SSE endpoint terpisah.
- Setiap page dashboard harus punya **error boundary** (`error.tsx`) supaya crash satu panel tidak menghancurkan seluruh dashboard.
- **`ConnectionStatus` component** wajib ada di layout untuk menunjukkan status koneksi ke Convex (connected/reconnecting/disconnected).

## 13. Repo Structure

Struktur repo final:

```text
/home/rahman/projects/vps-rahmanef/
├── frontend/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── error.tsx          # error boundary dashboard
│   │   │   ├── apps/
│   │   │   │   ├── page.tsx
│   │   │   │   └── error.tsx
│   │   │   ├── agents/
│   │   │   │   ├── page.tsx
│   │   │   │   └── error.tsx
│   │   │   ├── security/
│   │   │   │   ├── page.tsx
│   │   │   │   └── error.tsx
│   │   │   ├── events/
│   │   │   │   ├── page.tsx
│   │   │   │   └── error.tsx
│   │   │   ├── actions/
│   │   │   │   ├── page.tsx
│   │   │   │   └── error.tsx
│   │   │   └── audit/
│   │   │       ├── page.tsx
│   │   │       └── error.tsx
│   │   ├── login/page.tsx
│   │   ├── api/
│   │   │   ├── auth/login/route.ts
│   │   │   ├── auth/logout/route.ts
│   │   │   └── health/route.ts
│   │   └── layout.tsx             # root layout
│   ├── components/
│   │   ├── ui/                    # shadcn/ui
│   │   ├── MetricCard.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── AppTable.tsx
│   │   ├── AgentTable.tsx
│   │   ├── SecurityPanel.tsx
│   │   ├── EventTimeline.tsx
│   │   ├── AuditTable.tsx
│   │   ├── ConfirmActionDialog.tsx
│   │   └── ConnectionStatus.tsx
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── convex.ts
│   │   └── types.ts
│   ├── middleware.ts
│   ├── public/
│   ├── package.json
│   └── next.config.ts
├── agent/
│   ├── src/
│   │   ├── collectors/
│   │   │   ├── system.ts
│   │   │   ├── docker.ts
│   │   │   ├── dokploy.ts
│   │   │   ├── agents.ts
│   │   │   └── security.ts
│   │   ├── executor/
│   │   │   ├── index.ts
│   │   │   ├── allowlist.ts
│   │   │   └── validators.ts
│   │   ├── convex-client.ts       # Convex client setup dan auth
│   │   ├── health.ts              # HTTP health endpoint agent
│   │   ├── logger.ts              # structured logging
│   │   ├── config.ts
│   │   └── index.ts               # entry point dengan graceful shutdown
│   ├── package.json
│   └── tsconfig.json
├── convex/
│   ├── _generated/                # auto-generated oleh Convex CLI
│   ├── schema.ts
│   ├── events.ts
│   ├── commands.ts
│   ├── audit.ts
│   ├── snapshots.ts
│   ├── alerts.ts
│   ├── appStatus.ts
│   ├── agentStatus.ts
│   └── crons.ts                   # TTL cleanup scheduler
├── docs/
│   └── runbook.md
├── scripts/
│   ├── install-systemd.sh
│   └── deploy.sh                  # pull, build, restart services
├── .env.example
├── README.md
└── PRD.md
```

## 14. Environment Variables

Root env yang perlu didokumentasikan:

```env
# Auth
CONTROL_ROOM_SECRET=replace_me
CONTROL_ROOM_SESSION_SECRET=replace_me_different_from_above
SESSION_EXPIRY_HOURS=24

# Frontend
CONTROL_ROOM_PORT=4000
CONTROL_ROOM_HOST=100.100.63.13

# Agent
AGENT_HEALTH_PORT=4001
AGENT_COMMAND_POLL_INTERVAL_MS=2000
AGENT_COMMAND_TIMEOUT_MS=30000
AGENT_MAX_CONCURRENT_COMMANDS=3

# Convex self-hosted
CONVEX_DEPLOYMENT=local-dev-or-prod-name
CONVEX_URL=http://127.0.0.1:3210
CONVEX_SITE_URL=http://127.0.0.1:3211
CONVEX_ADMIN_KEY=replace_me

# Dokploy
DOKPLOY_URL=http://127.0.0.1:3000
DOKPLOY_API_KEY=replace_me

# Docker socket
DOCKER_SOCKET_PATH=/var/run/docker.sock

# Polling intervals (collectors)
SYSTEM_POLL_INTERVAL_MS=5000
SECURITY_POLL_INTERVAL_MS=10000
DOCKER_POLL_INTERVAL_MS=5000
AGENT_POLL_INTERVAL_MS=5000

# Alert thresholds
ALERT_CPU_WARNING_PERCENT=80
ALERT_CPU_CRITICAL_PERCENT=95
ALERT_RAM_WARNING_PERCENT=85
ALERT_RAM_CRITICAL_PERCENT=95
ALERT_DISK_WARNING_PERCENT=80
ALERT_DISK_CRITICAL_PERCENT=90
```

Catatan:

- `CONVEX_URL` harus mengarah ke backend API instance Convex yang benar, bukan dashboard port.
- `CONVEX_ADMIN_KEY` dipakai oleh agent untuk authenticate ke Convex self-hosted. Ambil dari admin panel Convex.
- `CONTROL_ROOM_SECRET` dan `CONTROL_ROOM_SESSION_SECRET` tidak boleh dikirim ke client.
- `CONTROL_ROOM_SESSION_SECRET` harus berbeda dari `CONTROL_ROOM_SECRET`. Yang pertama untuk sign cookie, yang kedua untuk login.

## 15. Auth Design

Karena single-user dan Tailscale-only, auth v1 cukup sederhana:

- login page menerima secret token
- server memverifikasi token terhadap `CONTROL_ROOM_SECRET` di env
- jika valid, server membuat signed session cookie menggunakan **HMAC-SHA256** dengan `CONTROL_ROOM_SESSION_SECRET` (key terpisah dari login secret)
- cookie payload: `{ issued_at, expires_at }`
- semua page dashboard dan route action memerlukan cookie valid

Cookie flags wajib:

- `HttpOnly: true`
- `SameSite: Strict`
- `Secure: false` (karena Tailscale internal, bukan HTTPS — bisa diubah jika pakai TLS)
- `Path: /`
- `Max-Age`: sesuai `SESSION_EXPIRY_HOURS`

Kebutuhan:

- rate limit: maksimal **5 login attempt per menit** per IP, implementasi sederhana menggunakan in-memory Map dengan TTL
- logout endpoint: `POST /api/auth/logout` — hapus cookie
- session expiry default: **24 jam** (configurable via `SESSION_EXPIRY_HOURS` env)

Tidak boleh:

- menyimpan secret token raw di localStorage
- mengirim secret raw berkali-kali pada setiap request client
- menyimpan session di database (cukup stateless signed cookie untuk single user)

## 16. systemd Deployment

Ada dua unit service:

- `vps-control-room-frontend.service`
- `vps-control-room-agent.service`

### 16.1 Frontend unit

```ini
[Unit]
Description=VPS Control Room Frontend
After=network.target

[Service]
Type=simple
User=rahman
WorkingDirectory=/home/rahman/projects/vps-rahmanef/frontend
EnvironmentFile=/home/rahman/projects/vps-rahmanef/.env.local
ExecStart=/usr/bin/node /home/rahman/projects/vps-rahmanef/frontend/.next/standalone/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vps-cr-frontend

[Install]
WantedBy=multi-user.target
```

Catatan: Next.js harus di-build dengan `output: "standalone"` di `next.config.ts` supaya bisa dijalankan langsung dengan `node`. Jika tidak pakai standalone, gunakan `ExecStart=/usr/bin/npm run start` sebagai fallback.

### 16.2 Agent unit

```ini
[Unit]
Description=VPS Control Room Agent
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=rahman
WorkingDirectory=/home/rahman/projects/vps-rahmanef/agent
EnvironmentFile=/home/rahman/projects/vps-rahmanef/.env.local
ExecStart=/usr/bin/node /home/rahman/projects/vps-rahmanef/agent/dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vps-cr-agent

[Install]
WantedBy=multi-user.target
```

Catatan implementasi:

- jika `agent` butuh akses ke Docker socket atau command tertentu, permission harus diatur dengan sadar. Jangan default ke root penuh tanpa alasan.
- jika pada praktiknya perlu wrapper systemd atau sudoers sempit, itu harus dibuat eksplisit di runbook.

## 16.3 Build dan deploy flow

Urutan deploy:

```bash
# 1. Pull kode terbaru
cd /home/rahman/projects/vps-rahmanef
git pull origin main

# 2. Install dependencies
cd frontend && npm install && npm run build && cd ..
cd agent && npm install && npm run build && cd ..

# 3. Push Convex schema/functions
cd convex && npx convex deploy && cd ..

# 4. Restart services
sudo systemctl restart vps-control-room-frontend
sudo systemctl restart vps-control-room-agent
```

Script `scripts/deploy.sh` harus mengotomasi langkah-langkah di atas.

### 16.4 Permission Docker socket

User `rahman` harus masuk ke group `docker`:

```bash
sudo usermod -aG docker rahman
```

Jika ada command yang butuh `sudo` (misalnya `systemctl restart`), buat sudoers entry sempit:

```text
rahman ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart vps-control-room-*
rahman ALL=(ALL) NOPASSWD: /usr/bin/fail2ban-client set sshd unbanip *
```

File sudoers: `/etc/sudoers.d/vps-control-room`

## 16.5 Agent Runtime Behavior

### Graceful shutdown

- Agent harus menangani `SIGTERM` dan `SIGINT`.
- Saat shutdown: selesaikan command yang sedang `running` (tunggu maks 10 detik), lalu set status command tersisa ke `cancelled`.
- Hentikan semua collector interval.
- Log shutdown event ke Convex sebelum exit.

### Command execution

- Agent poll `commands` table setiap `AGENT_COMMAND_POLL_INTERVAL_MS` (default 2 detik).
- Maksimal `AGENT_MAX_CONCURRENT_COMMANDS` (default 3) command bersamaan.
- Setiap command punya timeout `AGENT_COMMAND_TIMEOUT_MS` (default 30 detik). Jika timeout, set status ke `timeout`.
- Agent harus retry mutation ke Convex maksimal 3 kali dengan exponential backoff (1s, 2s, 4s) jika gagal.

### Convex connection failure

- Jika Convex tidak reachable, agent tetap mengumpulkan data collector.
- Data snapshot terakhir disimpan di memory (bukan file) dan dikirim begitu koneksi pulih.
- Agent mencatat `convex_unreachable` ke stdout log. Retry koneksi setiap 10 detik.

### Health endpoint

- Agent expose HTTP endpoint sederhana di `AGENT_HEALTH_PORT` (default 4001).
- `GET /health` return `{ status: "ok", uptime: number, convex_connected: boolean, last_snapshot: timestamp }`.

## 16.6 Alert Thresholds

Default thresholds (configurable via env):

| Metric | Warning | Critical |
|---|---|---|
| CPU total | 80% | 95% |
| RAM used | 85% | 95% |
| Disk used | 80% | 90% |

Alert lifecycle:

1. Collector mendeteksi metric melebihi threshold.
2. Agent membuat alert di Convex dengan status `active`.
3. Jika metric kembali normal, agent set alert ke `resolved` dengan `resolved_at`.
4. Alert `active` yang sudah di atas 1 jam tanpa perubahan, tetap ditampilkan di UI tapi tidak duplikat.
5. Jangan buat alert baru jika alert `active` dengan type dan target yang sama sudah ada.

## 17. MVP Scope

### In scope v1

- login sederhana berbasis secret
- overview panel
- apps & services panel
- agents panel
- security panel
- events timeline live
- audit log
- restart app/container yang dikenali
- view logs read-only
- unban IP fail2ban
- redeploy Dokploy dengan konfirmasi

### Out of scope v1

- backup/restore control
- firewall rule editor
- rollback deploy penuh
- Telegram alert
- multi-user roles
- conflict detector antar agent
- terminal web
- CLI/TUI terminal control untuk chat/command lintas agent (dipindah ke post-MVP, lihat section 21.1)

## 18. Acceptance Criteria

### Overview

- user bisa melihat CPU, RAM, disk, uptime, dan summary status tanpa reload manual
- data berubah otomatis maksimal dalam 10 detik

### Apps & Services

- semua app target awal muncul di daftar bila running
- published ports terlihat jelas
- restart action yang sukses muncul di audit dan events

### Agents

- semua agent target awal terdeteksi jika process hidup
- UI menampilkan PID dan uptime dengan benar

### Security

- login SSH sukses dan gagal terbaru terlihat
- fail2ban status terlihat
- exposed Docker ports yang bypass UFW bisa terlihat

### Audit

- semua action dari UI tercatat
- audit log bisa difilter minimal berdasarkan tanggal dan target

### Reliability

- frontend dan agent bisa restart otomatis setelah process crash
- dashboard tetap terbuka walau Dokploy sedang down

## 19. Risiko dan Mitigasi

### Risiko: control room jadi attack surface baru

Mitigasi:

- Tailscale only
- auth via signed session
- action allowlist
- audit log
- no shell access

### Risiko: agent terlalu kuat

Mitigasi:

- command allowlist
- target validation
- no arbitrary command
- minimal permission

### Risiko: data salah karena source berbeda

Mitigasi:

- Docker collector jadi source of truth untuk runtime container
- Dokploy collector dipakai untuk metadata deploy
- tampilkan source pada beberapa data penting bila perlu

### Risiko: Convex atau Dokploy down

Mitigasi:

- frontend tetap punya halaman degraded state
- agent tetap bisa collect lokal dan menandai backend sync failure

## 20. Task List Implementasi

Task list ini sengaja granular supaya bisa dijalankan model yang kurang kuat dengan lebih aman.

### Phase 0: Repo foundation

Dependency: tidak ada. Harus selesai sebelum Phase lain dimulai.

- Buat `frontend/` sebagai Next.js 15 app (`npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"`).
- Setup shadcn/ui di `frontend/` (`npx shadcn@latest init`).
- Buat `agent/` sebagai Node.js TypeScript package (`npm init -y`, tambah `typescript`, `tsx`, `@types/node` sebagai devDependencies).
- Buat `agent/tsconfig.json` dengan `target: ES2022`, `module: NodeNext`.
- Buat `convex/` dengan `npx convex init` (atau setup manual jika self-hosted).
- Buat `convex/schema.ts` sesuai section 11 (ini harus Phase 0 karena semua Phase lain bergantung padanya).
- Buat `.env.example` sesuai section 14.
- Buat `docs/runbook.md` minimal.
- Buat `scripts/install-systemd.sh`.
- Buat `scripts/deploy.sh`.

### Phase 1: Frontend shell

Dependency: Phase 0 selesai.

- Buat `frontend/lib/auth.ts`: function `signSession(payload)` dan `verifySession(cookie)` menggunakan HMAC-SHA256 dengan `CONTROL_ROOM_SESSION_SECRET`.
- Buat `frontend/app/api/auth/login/route.ts`: POST handler, validasi secret, set signed cookie.
- Buat `frontend/app/api/auth/logout/route.ts`: POST handler, hapus cookie.
- Buat `frontend/middleware.ts`: cek cookie valid di setiap request ke `/(dashboard)/*`, redirect ke `/login` jika invalid.
- Buat `frontend/app/login/page.tsx`: form input secret, POST ke `/api/auth/login`, redirect ke `/` jika sukses.
- Buat `frontend/app/(dashboard)/layout.tsx`: sidebar navigation ke Overview, Apps, Agents, Security, Events, Actions, Audit. Termasuk `ConnectionStatus` component.
- Buat `frontend/app/(dashboard)/page.tsx`: overview page dengan empty/loading state.
- Buat semua sub-pages (`apps`, `agents`, `security`, `events`, `actions`, `audit`) dengan empty state dan `error.tsx` per folder.
- Buat `frontend/app/api/health/route.ts`: return `{ status: "ok" }`.
- Buat `frontend/lib/convex.ts`: Convex client provider wrapper.

### Phase 2: Convex core

Dependency: `convex/schema.ts` dari Phase 0 sudah ada. Bisa paralel dengan Phase 1.

- Buat `convex/events.ts`: mutation `insertEvent`, query `listEvents` (paginated, filter by type/severity).
- Buat `convex/audit.ts`: mutation `insertAudit`, query `listAuditLogs` (paginated, filter by target/date).
- Buat `convex/commands.ts`: mutation `enqueueCommand`, mutation `updateCommandStatus`, query `pollPendingCommands` (index `by_status` where status=`queued`), query `listCommands`.
- Buat `convex/snapshots.ts`: mutation `upsertSystemSnapshot`, query `getLatestSnapshot`, query `getOverview` (gabungkan snapshot + alert count + app count + agent count).
- Buat `convex/alerts.ts`: mutation `upsertAlert` (buat baru atau update existing by type+target), mutation `resolveAlert`, query `listActiveAlerts`.
- Buat `convex/appStatus.ts`: mutation `upsertAppStatus`, query `listApps`.
- Buat `convex/agentStatus.ts`: mutation `upsertAgentStatus`, query `listAgents`.
- Buat `convex/crons.ts`: scheduled function untuk TTL cleanup `events` (30 hari) dan `system_snapshot` (7 hari), jalan setiap 1 jam.

### Phase 3: Agent collector core

Dependency: Phase 2 selesai (Convex mutations harus sudah ada).

- Buat `agent/src/config.ts`: load semua env variables dengan default values dan validasi. Throw error jika required env missing.
- Buat `agent/src/logger.ts`: structured logging sederhana (JSON ke stdout) dengan level `info`, `warn`, `error`.
- Buat `agent/src/convex-client.ts`: setup Convex client menggunakan `CONVEX_URL` dan `CONVEX_ADMIN_KEY`. Termasuk retry logic (3x exponential backoff).
- Buat `agent/src/collectors/system.ts`: baca `/proc/stat`, `/proc/meminfo`, `/proc/uptime`, `/proc/net/dev`, `df`. Output sesuai schema `system_snapshot`. Termasuk perhitungan `load_average` dari `/proc/loadavg`.
- Buat `agent/src/collectors/docker.ts`: query Docker socket (`/var/run/docker.sock`) via HTTP. List containers, inspect state/health/ports. Output sesuai schema `app_status` untuk source `docker`.
- Buat `agent/src/collectors/dokploy.ts`: query Dokploy API untuk app list dan deploy info. Merge dengan data Docker. Fallback ke Docker-only jika Dokploy unreachable.
- Buat `agent/src/collectors/agents.ts`: deteksi proses dari known list menggunakan `ps aux` atau `/proc`. Map ke schema `agent_status`.
- Buat `agent/src/collectors/security.ts`: baca `journalctl -u ssh.service`, `fail2ban-client status sshd`, `ufw status verbose`, `ss -tulpn`. Parse output ke format yang bisa dikirim ke Convex events dan ditampilkan UI.
- Buat scheduler di `agent/src/index.ts`: jalankan tiap collector pada interval masing-masing. Kirim hasilnya ke Convex mutations. Setiap collector di-wrap try/catch supaya error satu collector tidak menghentikan yang lain.
- Buat `agent/src/health.ts`: HTTP server sederhana di `AGENT_HEALTH_PORT`.
- Implement graceful shutdown handler di `agent/src/index.ts` (SIGTERM/SIGINT).

### Phase 4: UI data binding

Dependency: Phase 1 dan Phase 2 selesai.

- Buat `MetricCard` component: kartu dengan label, value, unit, dan optional trend indicator.
- Buat `StatusBadge` component: badge warna sesuai status (green=healthy, yellow=warning, red=error, gray=unknown).
- Bind overview page: subscribe ke `getLatestSnapshot` dan `listActiveAlerts`. Tampilkan CPU, RAM, disk, uptime, network, alert count, quick status badges.
- Buat `AppTable` component dan bind apps page: subscribe ke `listApps`. Tampilkan tabel dengan kolom sesuai section 7.2.
- Buat `AgentTable` component dan bind agents page: subscribe ke `listAgents`. Tampilkan tabel sesuai section 7.3.
- Buat `SecurityPanel` component dan bind security page: subscribe ke events dengan type `security.*`. Tampilkan SSH logins, fail2ban status, UFW rules, listening ports.
- Buat `EventTimeline` component dan bind events page: subscribe ke `listEvents` dengan live tail. Auto-scroll ke event terbaru.
- Buat `AuditTable` component dan bind audit page: subscribe ke `listAuditLogs`. Tambah filter by date range dan target.
- Buat `ConnectionStatus` component: subscribe ke Convex connection state, tampilkan indicator di layout.

### Phase 5: Action pipeline

Dependency: Phase 3 selesai (agent sudah bisa connect ke Convex).

- Buat `agent/src/executor/allowlist.ts`: definisikan map action → command template. Contoh: `{ "container.restart": "docker container restart {target_id}", "container.logs": "docker logs --tail {payload.lines} {target_id}" }`. Known targets harus di-maintain dari collector results.
- Buat `agent/src/executor/validators.ts`: validasi bahwa `target_id` ada di known targets (dari collector terakhir), `action` ada di allowlist, dan `payload` sesuai schema action tersebut.
- Buat `agent/src/executor/index.ts`: poll `pollPendingCommands` setiap `AGENT_COMMAND_POLL_INTERVAL_MS`. Untuk setiap command: set status `running`, jalankan via `child_process.exec` dengan timeout, set status `success`/`failed`/`timeout`, tulis audit log via `insertAudit` mutation.
- Implement action `container.restart`: `docker container restart <known-container>`.
- Implement action `container.stop`: `docker container stop <known-container>` (sensitive, butuh konfirmasi di UI).
- Implement action `container.logs`: `docker logs --tail N <known-container>`. Simpan output di result field.
- Implement action `service.restart`: `sudo systemctl restart <known-service>`.
- Implement action `dokploy.redeploy`: HTTP POST ke Dokploy API (sensitive).
- Implement action `fail2ban.unban`: `sudo fail2ban-client set sshd unbanip <ip>` (validate IP format).
- Buat `ConfirmActionDialog` component di frontend: modal dengan nama action, target, dan tombol confirm/cancel. Wajib untuk sensitive actions.
- Bind actions page: form untuk trigger action, status tracking, dan result display.

### Phase 6: Hardening

Dependency: Phase 5 selesai.

- Implement rate limit login: in-memory Map, max 5 attempts per IP per menit, return 429 jika melebihi.
- Audit semua route handler: pastikan setiap route di `(dashboard)/*` dan `/api/*` (kecuali `/api/health` dan `/api/auth/login`) memerlukan valid session cookie.
- Audit allowlist: pastikan tidak ada path di executor yang bisa menerima input arbitrary. Test dengan target_id yang tidak ada di known list.
- Audit env: pastikan `CONTROL_ROOM_SECRET`, `CONTROL_ROOM_SESSION_SECRET`, dan `CONVEX_ADMIN_KEY` tidak pernah dikirim ke client (tidak ada di `NEXT_PUBLIC_*`).
- Pastikan `NEXT_PUBLIC_CONVEX_URL` hanya berisi URL Convex (ini aman karena Convex punya auth sendiri).
- Test error boundary: simulasi crash di satu panel, pastikan panel lain tetap hidup.
- Test Convex disconnect: matikan Convex sementara, pastikan UI menunjukkan disconnected state dan agent tetap berjalan.

### Phase 7: Deployment

- Buat build dan start script untuk frontend.
- Buat build dan start script untuk agent.
- Buat systemd unit file final.
- Jalankan dan enable service.
- Verifikasi auto restart.
- Verifikasi akses hanya lewat Tailscale.

### Phase 8: Verification checklist

- Verifikasi overview update live.
- Verifikasi app list cocok dengan Docker/Dokploy nyata.
- Verifikasi agent list cocok dengan process nyata.
- Verifikasi security panel menampilkan data nyata.
- Verifikasi action restart container sukses.
- Verifikasi audit log tercatat.
- Verifikasi event timeline bertambah live.
- Verifikasi frontend tetap hidup saat Dokploy down.

## 21. Task List Teknis Sangat Detail

Bagian ini untuk meminimalkan ambiguity saat dieksekusi model lain.

### Frontend — file by file

- `npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"` lalu `cd frontend && npx shadcn@latest init`.
- `frontend/lib/auth.ts`: export `signSession(payload, secret): string` dan `verifySession(cookie, secret): payload | null`. Gunakan Node.js `crypto.createHmac('sha256', secret)`. Payload format: `base64(JSON({issued_at, expires_at})).base64(hmac)`.
- `frontend/lib/convex.ts`: Convex React provider, pakai `NEXT_PUBLIC_CONVEX_URL`.
- `frontend/lib/types.ts`: shared types untuk UI (metric, status, dll).

## 21.1 Post-MVP Extension: Terminal Features (CLI/TUI + Agent Chat)

Tujuan section ini adalah memberi jalur implementasi untuk kebutuhan terminal features tanpa melanggar prinsip keamanan v1.

### 21.1.1 Scope extension

Fitur terminal yang dimaksud:

- user bisa trigger action dari **CLI** (misal `vpsctl`) selain dari dashboard web
- user bisa memakai **TUI** untuk melihat status realtime dan menjalankan action yang sama dengan UI
- user bisa kirim command terstruktur ke agent yang dikenali (bukan shell bebas)
- seluruh aksi CLI/TUI tetap masuk ke `commands`, `events`, dan `audit_log`

### 21.1.2 Guardrails wajib

- tetap **tidak ada shell arbitrary**
- CLI/TUI hanya boleh memanggil action yang sudah ada di allowlist executor
- target harus berasal dari known targets hasil collector terakhir
- actor harus dibedakan:
  - `manual-dashboard`
  - `manual-cli`
  - `manual-tui`
- command dari CLI/TUI tetap wajib punya `request_id` dan lifecycle status standar

### 21.1.3 Arsitektur yang direkomendasikan

Komponen tambahan:

- `cli/` package (Node.js/TypeScript)
  - subcommand: `status`, `apps`, `agents`, `events tail`, `action run`
- `tui/` package (Node.js/TypeScript, berbasis terminal UI library)
  - panel ringkas: overview/apps/agents/events/actions
- keduanya memakai Convex sebagai transport yang sama dengan frontend

Alur:

1. CLI/TUI login memakai secret/session flow khusus terminal (token lokal dengan expiry).
2. CLI/TUI enqueue command ke `commands`.
3. Agent executor memproses command seperti biasa.
4. CLI/TUI subscribe status result dari `commands` + `events`.
5. Semua hasil ditulis ke `audit_log` dengan actor sesuai channel.

### 21.1.4 Task list implementasi terminal

#### Phase T1 — Shared command SDK

- Buat `packages/control-room-sdk/` untuk wrapper query/mutation Convex yang dipakai frontend + CLI + TUI.
- Tambah helper:
  - `enqueueAction(action, target_type, target_id, payload, actor)`
  - `waitForCommandResult(request_id, timeout_ms)`
  - `listKnownTargets()`

#### Phase T2 — CLI binary (`vpsctl`)

- Buat `cli/` package dengan command:
  - `vpsctl status`
  - `vpsctl apps list`
  - `vpsctl agents list`
  - `vpsctl events tail`
  - `vpsctl action run <action> --target <id> [--json-payload ...]`
- Tambah opsi `--confirm` untuk sensitive actions.
- Tambah output mode `--json` untuk automasi script.

#### Phase T3 — TUI dashboard

- Buat `tui/` package untuk terminal dashboard interaktif.
- Minimal panel:
  - host snapshot live
  - app table
  - agent table
  - events tail
  - action confirm modal (keyboard-based)
- TUI harus menampilkan `ConnectionStatus` versi terminal (connected/reconnecting/disconnected).

#### Phase T4 — Auth & identity untuk terminal channel

- Tambah endpoint/login flow khusus machine-friendly:
  - issue short-lived terminal token
  - simpan encrypted token local (`~/.config/vpsctl/session.json`)
- Tambah rate limit terpisah untuk login terminal.

#### Phase T5 — Hardening & observability

- Tambah kolom opsional di `commands`/`audit_log`:
  - `channel` (`dashboard` | `cli` | `tui`)
  - `client_version`
- Tambah alert bila ada burst command dari CLI/TUI yang tidak normal.
- Tambah test e2e:
  - enqueue dari CLI → dieksekusi agent → result sukses
  - sensitive action tanpa `--confirm` harus ditolak
  - target unknown harus gagal validasi
- `frontend/middleware.ts`: Next.js middleware, cek cookie `session` ada dan valid via `verifySession`. Jika invalid dan path bukan `/login` atau `/api/auth/*` atau `/api/health`, redirect ke `/login`.
- `frontend/app/api/auth/login/route.ts`: POST, body `{ secret }`, validasi terhadap `CONTROL_ROOM_SECRET`, jika cocok set cookie dengan `signSession`, return 200. Jika salah return 401. Rate limit: in-memory Map max 5/menit per IP.
- `frontend/app/api/auth/logout/route.ts`: POST, hapus cookie `session`, return 200.
- `frontend/app/api/health/route.ts`: GET, return `{ status: "ok" }`.
- `frontend/app/login/page.tsx`: form dengan satu input secret dan tombol login. Client-side POST ke `/api/auth/login`. Redirect ke `/` on success. Tampilkan error on 401/429.
- `frontend/app/(dashboard)/layout.tsx`: layout dengan sidebar (link ke semua pages), header, dan `ConnectionStatus` component. Wrap children dengan Convex provider.
- `frontend/app/(dashboard)/page.tsx`: overview page. Subscribe ke `getLatestSnapshot`, `listActiveAlerts`. Render `MetricCard` untuk CPU/RAM/disk/uptime/network, `StatusBadge` untuk layanan inti.
- `frontend/app/(dashboard)/error.tsx`: catch-all error boundary untuk dashboard.
- `frontend/app/(dashboard)/apps/page.tsx`: subscribe ke `listApps`, render `AppTable`. Action buttons: restart, view logs, refresh.
- `frontend/app/(dashboard)/apps/error.tsx`.
- `frontend/app/(dashboard)/agents/page.tsx`: subscribe ke `listAgents`, render `AgentTable`.
- `frontend/app/(dashboard)/agents/error.tsx`.
- `frontend/app/(dashboard)/security/page.tsx`: subscribe ke security events, render `SecurityPanel`.
- `frontend/app/(dashboard)/security/error.tsx`.
- `frontend/app/(dashboard)/events/page.tsx`: subscribe ke `listEvents`, render `EventTimeline` dengan auto-scroll.
- `frontend/app/(dashboard)/events/error.tsx`.
- `frontend/app/(dashboard)/actions/page.tsx`: UI untuk trigger actions. Dropdown target, dropdown action, confirm dialog. Subscribe ke `listCommands` untuk status tracking.
- `frontend/app/(dashboard)/actions/error.tsx`.
- `frontend/app/(dashboard)/audit/page.tsx`: subscribe ke `listAuditLogs`, render `AuditTable` dengan filter date/target.
- `frontend/app/(dashboard)/audit/error.tsx`.
- `frontend/components/MetricCard.tsx`: props `{ label, value, unit, trend? }`.
- `frontend/components/StatusBadge.tsx`: props `{ status, label }`. Color map: running/healthy=green, warning=yellow, error/stopped=red, unknown=gray.
- `frontend/components/AppTable.tsx`: tabel apps sesuai section 7.2 dengan action buttons.
- `frontend/components/AgentTable.tsx`: tabel agents sesuai section 7.3.
- `frontend/components/SecurityPanel.tsx`: panel multi-section: SSH logins, fail2ban, UFW, ports.
- `frontend/components/EventTimeline.tsx`: list events dengan timestamp, icon per severity, auto-scroll to bottom.
- `frontend/components/AuditTable.tsx`: tabel audit log dengan filter controls.
- `frontend/components/ConfirmActionDialog.tsx`: modal shadcn dialog. Props `{ action, target, onConfirm, onCancel }`. Wajib untuk sensitive actions.
- `frontend/components/ConnectionStatus.tsx`: dot indicator (green=connected, yellow=reconnecting, red=disconnected) + tooltip.

### Agent — file by file

- `cd agent && npm init -y && npm install typescript tsx @types/node convex --save-dev` (adjust Convex package sesuai self-hosted setup).
- `agent/tsconfig.json`: `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, `outDir: dist`, `strict: true`.
- `agent/package.json` scripts: `"build": "tsc"`, `"start": "node dist/index.js"`, `"dev": "tsx src/index.ts"`.
- `agent/src/config.ts`: load dan validasi semua env. Export typed config object. Throw jika required env missing (`CONVEX_URL`, `CONVEX_ADMIN_KEY`). Default values untuk optional env.
- `agent/src/logger.ts`: function `log(level, message, data?)` → JSON ke stdout. Format: `{"ts":"ISO","level":"info","msg":"...","data":{}}`.
- `agent/src/convex-client.ts`: setup Convex client. Export helper function `mutate(fn, args)` dan `query(fn, args)` dengan retry logic (3x, backoff 1s/2s/4s). Track `convex_connected` state.
- `agent/src/collectors/system.ts`: export `collectSystem(): SystemSnapshot`. Baca `/proc/stat` (hitung delta CPU), `/proc/meminfo`, `/proc/uptime`, `/proc/loadavg`, `/proc/net/dev`, `df -B1 --output=target,size,used,avail`. Return object sesuai schema.
- `agent/src/collectors/docker.ts`: export `collectDocker(): AppStatus[]`. HTTP GET ke Docker socket: `GET /containers/json?all=true`. Untuk setiap container: map name, state, health, ports. Return array sesuai schema.
- `agent/src/collectors/dokploy.ts`: export `collectDokploy(): Partial<AppStatus>[]`. GET Dokploy API `/api/application.all` (atau endpoint yang tersedia). Merge deploy info. Catch error dan return `[]` jika Dokploy unreachable.
- `agent/src/collectors/agents.ts`: export `collectAgents(): AgentStatus[]`. Jalankan `ps aux` dan filter untuk known agent list. Parse PID, CPU%, MEM, elapsed time. Return array sesuai schema.
- `agent/src/collectors/security.ts`: export `collectSecurity(): SecurityData`. Jalankan: `journalctl -u ssh.service --since "1 hour ago" --no-pager -o json`, `fail2ban-client status sshd`, `ufw status verbose`, `ss -tulpn`. Parse semua output. Return structured data. Generate events untuk anomali (login gagal banyak, banned IP baru, port baru).
- `agent/src/executor/allowlist.ts`: export `ALLOWLIST: Map<string, ActionDefinition>`. Tiap entry: `{ command_template, target_type, sensitive, timeout_ms }`. Known targets di-update dari collector results.
- `agent/src/executor/validators.ts`: export `validateCommand(cmd, knownTargets): ValidationResult`. Cek action ada di allowlist, target_id ada di known targets, payload sesuai. Return `{ valid: true }` atau `{ valid: false, reason: string }`.
- `agent/src/executor/index.ts`: export `startExecutor()`. Poll pending commands. Validate. Execute via `child_process.exec` dengan timeout. Update command status. Insert audit log. Respect `AGENT_MAX_CONCURRENT_COMMANDS`.
- `agent/src/health.ts`: HTTP server di `AGENT_HEALTH_PORT`. `GET /health` return JSON status.
- `agent/src/index.ts`: entry point. Load config. Init Convex client. Start semua collectors pada interval. Start executor. Start health server. Handle SIGTERM/SIGINT graceful shutdown.

### Convex — file by file

- `convex/schema.ts`: definisikan semua 7 tabel dengan kolom dan index sesuai section 11. Gunakan `defineSchema` dan `defineTable` dari Convex.
- `convex/events.ts`: `insertEvent` (mutation), `listEvents` (query, paginated, optional filter by type/severity, order by timestamp desc).
- `convex/audit.ts`: `insertAudit` (mutation), `listAuditLogs` (query, paginated, optional filter by target/action/date range).
- `convex/commands.ts`: `enqueueCommand` (mutation — generate request_id, set status `queued`), `updateCommandStatus` (mutation), `pollPendingCommands` (query — return commands where status=`queued` ordered by requested_at asc, limit 10), `listCommands` (query, paginated).
- `convex/snapshots.ts`: `upsertSystemSnapshot` (mutation — insert baru, bukan update), `getLatestSnapshot` (query — return snapshot terbaru), `getOverview` (query — gabungkan latest snapshot + count alerts active + count apps + count agents).
- `convex/alerts.ts`: `upsertAlert` (mutation — cek apakah alert active dengan type+target sama sudah ada, jika ya update, jika tidak insert baru), `resolveAlert` (mutation), `listActiveAlerts` (query).
- `convex/appStatus.ts`: `upsertAppStatus` (mutation — by name), `listApps` (query).
- `convex/agentStatus.ts`: `upsertAgentStatus` (mutation — by name), `listAgents` (query).
- `convex/crons.ts`: register cron job `cleanupOldEvents` (setiap 1 jam, hapus events > 30 hari, batch 100), `cleanupOldSnapshots` (setiap 1 jam, hapus snapshots > 7 hari, batch 100).

## 22. Open Questions

Resolved:

- ~~Apakah `agent` akan diberi akses Docker group saja, atau perlu sudoers sempit?~~ → Docker group + sudoers sempit untuk systemctl dan fail2ban (lihat section 16.4).

Masih terbuka:

- Endpoint dan auth final Convex self-hosted yang akan dipakai persis apa? (sementara asumsikan `CONVEX_URL=http://127.0.0.1:3210` dengan `CONVEX_ADMIN_KEY`)
- Dokploy API mana saja yang tersedia dan stabil untuk redeploy/restart? (investigasi saat Phase 3, jika tidak tersedia gunakan Docker restart sebagai fallback)
- Apakah panel akan bind ke `127.0.0.1:4000` lalu diproxy, atau langsung ke IP Tailscale? (sementara bind ke `CONTROL_ROOM_HOST` langsung)
- Healthcheck app mana saja yang punya endpoint HTTP valid? (discovery saat Phase 3, catat di config)
- Apakah Convex self-hosted instance sudah running dan siap dipakai, atau perlu setup dari nol?

## 23. Definition of Done v1

v1 dianggap selesai jika:

- repo punya `frontend`, `agent`, dan `convex`
- frontend bisa login dan menampilkan dashboard
- agent bisa collect data host nyata
- data live tersinkron ke Convex
- apps, agents, dan security panel menampilkan data nyata
- action utama minimal satu bisa dieksekusi sukses dari UI
- audit log dan events berjalan
- frontend dan agent berjalan lewat systemd
- akses hanya tersedia via Tailscale
