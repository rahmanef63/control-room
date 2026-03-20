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
