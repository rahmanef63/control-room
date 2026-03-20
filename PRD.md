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

Berikut tabel minimum:

### `events`

Tujuan:

- timeline live
- TTL 30 hari

Kolom:

- `timestamp`
- `type`
- `message`
- `severity`
- `source`
- `target`
- `metadata`

### `audit_log`

Tujuan:

- jejak permanen semua action

Kolom:

- `timestamp`
- `action`
- `target`
- `result`
- `triggered_by`
- `request_id`
- `metadata`

### `agent_status`

Tujuan:

- upsert status agent known list

Kolom:

- `name`
- `pid`
- `status`
- `cpu`
- `memory`
- `uptime_seconds`
- `last_seen`
- `metadata`

### `system_snapshot`

Tujuan:

- snapshot berkala host
- TTL 7 hari

Kolom:

- `timestamp`
- `cpu_total`
- `cpu_cores`
- `ram_total`
- `ram_used`
- `ram_available`
- `disk`
- `network`

### `alerts`

Tujuan:

- alert aktif dan resolved state

Kolom:

- `type`
- `message`
- `severity`
- `status`
- `created_at`
- `resolved_at`
- `metadata`

### `commands`

Tujuan:

- command queue dua arah frontend ke agent

Kolom:

- `request_id`
- `action`
- `target_type`
- `target_id`
- `payload`
- `status`
- `requested_by`
- `requested_at`
- `started_at`
- `finished_at`
- `result`
- `error`

### `app_status`

Tujuan:

- cache status apps/service yang ditampilkan UI

Kolom:

- `name`
- `source`
- `runtime_status`
- `health_status`
- `ports`
- `domain`
- `last_seen`
- `metadata`

## 12. UI / Route Structure

Frontend berada di `frontend/` dan menggunakan App Router.

Struktur minimal:

```text
frontend/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx
│   │   ├── apps/page.tsx
│   │   ├── agents/page.tsx
│   │   ├── security/page.tsx
│   │   ├── events/page.tsx
│   │   ├── actions/page.tsx
│   │   └── audit/page.tsx
│   ├── login/page.tsx
│   └── api/
│       ├── auth/route.ts
│       ├── health/route.ts
│       └── logs/[target]/route.ts
├── components/
├── lib/
└── package.json
```

Catatan:

- Route action utama tidak perlu mengeksekusi host command langsung.
- Frontend menulis command ke Convex atau memanggil endpoint internal tipis yang meneruskan request ke Convex.

## 13. Repo Structure

Struktur repo final:

```text
/home/rahman/projects/vps-rahmanef/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
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
│   │   ├── convex/
│   │   │   └── client.ts
│   │   ├── config.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── convex/
│   ├── schema.ts
│   ├── events.ts
│   ├── commands.ts
│   ├── audit.ts
│   ├── snapshots.ts
│   └── alerts.ts
├── docs/
│   └── runbook.md
├── scripts/
│   └── install-systemd.sh
├── .env.example
├── README.md
└── PRD.md
```

## 14. Environment Variables

Root env yang perlu didokumentasikan:

```env
CONTROL_ROOM_SECRET=replace_me
CONTROL_ROOM_PORT=4000
CONTROL_ROOM_HOST=100.100.63.13

# Convex self-hosted
CONVEX_DEPLOYMENT=local-dev-or-prod-name
CONVEX_URL=http://127.0.0.1:3210
CONVEX_SITE_URL=http://127.0.0.1:3211

# Dokploy
DOKPLOY_URL=http://127.0.0.1:3000
DOKPLOY_API_KEY=replace_me

# Docker socket
DOCKER_SOCKET_PATH=/var/run/docker.sock

# Polling
SYSTEM_POLL_INTERVAL_MS=5000
SECURITY_POLL_INTERVAL_MS=10000
DOCKER_POLL_INTERVAL_MS=5000
AGENT_POLL_INTERVAL_MS=5000
```

Catatan:

- `CONVEX_URL` harus mengarah ke backend API instance Convex yang benar, bukan dashboard port.
- `CONTROL_ROOM_SECRET` tidak boleh dikirim ke client.

## 15. Auth Design

Karena single-user dan Tailscale-only, auth v1 cukup sederhana:

- login page menerima secret token
- server memverifikasi token terhadap env
- jika valid, server membuat signed HTTP-only session cookie
- semua page dashboard dan route action memerlukan cookie valid

Kebutuhan:

- rate limit ringan pada endpoint login
- logout endpoint
- session expiry configurable

Tidak boleh:

- menyimpan secret token raw di localStorage
- mengirim secret raw berkali-kali pada setiap request client

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
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

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
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Catatan implementasi:

- jika `agent` butuh akses ke Docker socket atau command tertentu, permission harus diatur dengan sadar. Jangan default ke root penuh tanpa alasan.
- jika pada praktiknya perlu wrapper systemd atau sudoers sempit, itu harus dibuat eksplisit di runbook.

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

- Buat `frontend/` sebagai Next.js 15 app.
- Buat `agent/` sebagai Node.js TypeScript package.
- Buat `convex/` schema dan functions dasar.
- Buat `.env.example`.
- Buat `docs/runbook.md`.
- Buat script install systemd.

### Phase 1: Frontend shell

- Implement login page.
- Implement session middleware / auth guard.
- Buat layout dashboard.
- Buat sidebar ke Overview, Apps, Agents, Security, Events, Actions, Audit.
- Buat empty states dan loading states.

### Phase 2: Convex core

- Buat schema untuk `events`, `audit_log`, `agent_status`, `system_snapshot`, `alerts`, `commands`, `app_status`.
- Buat mutation untuk insert event.
- Buat mutation untuk append audit log.
- Buat mutation untuk create command.
- Buat mutation untuk update command status/result.
- Buat query untuk overview summary.
- Buat query untuk app list.
- Buat query untuk agent list.
- Buat query untuk alerts aktif.

### Phase 3: Agent collector core

- Implement config loader.
- Implement system collector.
- Implement docker collector.
- Implement dokploy collector.
- Implement process/agent collector.
- Implement security collector.
- Buat scheduler polling.
- Kirim hasil collector ke Convex.

### Phase 4: UI data binding

- Bind overview ke snapshot dan alerts.
- Bind apps page ke `app_status`.
- Bind agents page ke `agent_status`.
- Bind security page ke data collector security.
- Bind events page ke `events`.
- Bind audit page ke `audit_log`.

### Phase 5: Action pipeline

- Definisikan allowlist action.
- Buat commands table consumer pada agent.
- Buat executor validator.
- Implement restart container action.
- Implement fetch logs action.
- Implement restart systemd service action untuk known service.
- Implement Dokploy redeploy action.
- Implement fail2ban unban action.
- Tulis audit log untuk semua action.

### Phase 6: Hardening

- Tambah login rate limit ringan.
- Pastikan semua action butuh auth.
- Pastikan target action tidak arbitrary.
- Pastikan secret tidak bocor ke client.
- Tambah health endpoint frontend.
- Tambah health event pada agent.

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

### Frontend

- Setup Next.js App Router di `frontend/`.
- Tambah Tailwind dan shadcn/ui.
- Buat `app/login/page.tsx`.
- Buat `app/(dashboard)/layout.tsx`.
- Buat `app/(dashboard)/page.tsx`.
- Buat `app/(dashboard)/apps/page.tsx`.
- Buat `app/(dashboard)/agents/page.tsx`.
- Buat `app/(dashboard)/security/page.tsx`.
- Buat `app/(dashboard)/events/page.tsx`.
- Buat `app/(dashboard)/actions/page.tsx`.
- Buat `app/(dashboard)/audit/page.tsx`.
- Buat komponen `MetricCard`.
- Buat komponen `StatusBadge`.
- Buat komponen `AppTable`.
- Buat komponen `AgentTable`.
- Buat komponen `SecurityPanel`.
- Buat komponen `EventTimeline`.
- Buat komponen `AuditTable`.
- Buat komponen `ConfirmActionDialog`.

### Agent

- Setup package TypeScript di `agent/`.
- Buat `src/config.ts`.
- Buat `src/index.ts`.
- Buat `src/collectors/system.ts`.
- Buat `src/collectors/docker.ts`.
- Buat `src/collectors/dokploy.ts`.
- Buat `src/collectors/agents.ts`.
- Buat `src/collectors/security.ts`.
- Buat `src/executor/allowlist.ts`.
- Buat `src/executor/validators.ts`.
- Buat `src/executor/index.ts`.
- Buat client Convex untuk query/mutation internal.
- Tambah structured logging sederhana.

### Convex

- Buat `schema.ts`.
- Buat function query `getOverview`.
- Buat function query `listApps`.
- Buat function query `listAgents`.
- Buat function query `listEvents`.
- Buat function query `listAuditLogs`.
- Buat mutation `upsertSystemSnapshot`.
- Buat mutation `upsertAppStatus`.
- Buat mutation `upsertAgentStatus`.
- Buat mutation `insertEvent`.
- Buat mutation `insertAudit`.
- Buat mutation `enqueueCommand`.
- Buat mutation `updateCommandStatus`.
- Buat query `pollPendingCommandsForAgent`.

## 22. Open Questions

- Endpoint dan auth final Convex self-hosted yang akan dipakai persis apa?
- Dokploy API mana saja yang tersedia dan stabil untuk redeploy/restart?
- Apakah `agent` akan diberi akses Docker group saja, atau perlu sudoers sempit untuk command tertentu?
- Apakah panel akan bind ke `127.0.0.1:4000` lalu diproxy, atau langsung ke IP Tailscale?
- Healthcheck app mana saja yang punya endpoint HTTP valid?

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
