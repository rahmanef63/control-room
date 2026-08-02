---
description: Drive the local vps-cr CLI from Claude Code — start/stop, doctor, config, device approval (acc/list/revoke), status, secret. Usage: /vps-cr <menu> [args], e.g. /vps-cr --acc <id> or /vps-cr doctor --fix
argument-hint: <menu> [args]   e.g. doctor --fix | --acc <id> | start | status
---

# /vps-cr — Local Control Room operator

Kamu adalah operator CLI `vps-cr` (instalasi LOKAL Control Room di mesin user).
User memanggil `/vps-cr $ARGUMENTS`. Jalankan operasi yang sesuai, lalu laporkan
hasilnya dengan bahasa sederhana. Prefix `--` opsional — `--acc` == `acc`.

Arguments yang diberikan user: **$ARGUMENTS**

## Cara menjalankan

CLI ini cross-platform. Pilih sesuai OS:

- **Windows (PowerShell, default di mesin ini):**
  ```powershell
  vps-cr $ARGUMENTS
  ```
  Jika fungsi `vps-cr` belum termuat di sesi ini, panggil brain-nya langsung:
  ```powershell
  node "$HOME\projects\vps-control-room\scripts\local\control.mjs" $ARGUMENTS
  ```
- **macOS / Linux:**
  ```bash
  vps-cr $ARGUMENTS    # atau: node ~/vps-control-room/scripts/local/control.mjs $ARGUMENTS
  ```

Normalisasi: buang `--` di depan verb pertama bila ada (`--acc 123` → `acc 123`).

## Menu (peta perintah)

| Yang diketik user | Yang dijalankan | Efek |
| --- | --- | --- |
| `/vps-cr app` | `vps-cr app` | buka **dashboard penuh di window app NATIVE** (WebView2/Edge app-mode — semua fitur, ringan, bukan di browser berat) |
| `/vps-cr term [n]` | `vps-cr term [n]` | buka **n pane terminal NATIVE** (Windows Terminal, no browser — tercepat/teringan untuk sekadar shell) |
| `/vps-cr ssh [target]` | `vps-cr ssh [target]` | buka **pane SSH native** ke VPS (default `vpsku`) |
| `/vps-cr build` | `vps-cr build` | build server PROD enteng (atasi UI freeze saat banyak pane) |
| `/vps-cr` atau `/vps-cr open` | `vps-cr` | start frontend+agent **lalu buka browser** |
| `/vps-cr start` | `vps-cr start` | start services **tanpa browser** (hemat RAM) |
| `/vps-cr stop` | `vps-cr stop` | hentikan kedua service |
| `/vps-cr status` | `vps-cr status` | kesehatan port 4000 / 4001 |
| `/vps-cr doctor` | `vps-cr doctor` | diagnosa config + service |
| `/vps-cr doctor --fix` | `vps-cr doctor --fix` | perbaiki config otomatis (tanpa sentuh secret valid) |
| `/vps-cr config` | `vps-cr config` | set/lihat password + tulis `.env.local` |
| `/vps-cr config --reset` | `vps-cr config --reset` | regenerate semua secret |
| `/vps-cr --acc <id>` | `vps-cr acc <id>` | setujui satu device login |
| `/vps-cr list` | `vps-cr list` | daftar device pending/approved |
| `/vps-cr --revoke <id>` | `vps-cr revoke <id>` | cabut device |
| `/vps-cr secret` | `vps-cr secret` | cetak secret acak baru |
| `/vps-cr help` | `vps-cr help` | menu lengkap |

## Aturan

- **JANGAN** menjalankan perintah VPS/produksi (`scripts/deploy.sh`,
  `install-systemd.sh`, `bump-version.sh`) — ini jalur LOKAL saja.
- **JANGAN** menampilkan isi `.env.local` atau secret/password ke chat. Kalau
  perlu password, suruh user jalankan `vps-cr config` sendiri.
- Kalau `vps-cr` "not recognized": fungsinya belum termuat di sesi PowerShell —
  jalankan via brain (`node ...\control.mjs ...`) atau suruh user buka terminal
  baru / jalankan `scripts\win-local\install-vps-cr-command.ps1` sekali.
- Setelah `start`/`stop`, verifikasi dengan `vps-cr status` sebelum bilang beres.
- Untuk masalah apa pun, **doctor dulu**: `vps-cr doctor` → baca → `--fix` bila perlu.
- Argumen kosong (`/vps-cr` tanpa apa-apa) = `open` (start + browser).
