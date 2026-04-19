# QA Report & Product Requirements Document
## VPS Control Room — Terminals Page

**URL:** https://<your-domain>/terminals  
**Audit Date:** 2 April 2026  
**Auditor:** Perplexity AI (based on live page content extraction + mobile-first design standards)  
**Version:** 1.0.0  
**Status:** Draft — Pending Engineering Review

---

## Executive Summary

VPS Control Room adalah internal tool yang berfungsi sebagai **LIVE AGENT COCKPIT** untuk mengelola multi-agent terminal sessions, bound environments, dan agent presets di atas infrastruktur VPS. Halaman Terminals saat ini memiliki **5 fitur utama** yang sudah berjalan: Active Terminal Pane, Base Terminal Launcher, Agent Presets, Environment Launcher, dan status metrics strip.

Secara fungsional, halaman ini telah mencakup workflow inti yang dibutuhkan. Namun dari perspektif **mobile-first design**, masih terdapat **17 isu kritis dan major** yang mempengaruhi usability di viewport ≤768px. Skor keseluruhan dari audit ini adalah **5.6 / 10** untuk mobile readiness.

---

## 1. Scope Audit

### 1.1 Fitur yang Diaudit

| # | Fitur | Status Ditemukan |
|---|-------|-----------------|
| 1 | Sidebar Toggle | ✅ Ada |
| 2 | Metrics Strip (LIVE PANES, RUNNING, ENVIRONMENTS, AGENT PRESETS) | ✅ Ada |
| 3 | Active Terminals Section (Terminal Pane + Toolbar) | ✅ Ada |
| 4 | Base Terminals Launcher (5 tipe: SHELL, CODEX, CLAUDE, GEMINI, OPENCLAW) | ✅ Ada |
| 5 | Agent Presets (4 preset dengan BOUND ENVIRONMENT + SKILLS) | ✅ Ada |
| 6 | Environment Launcher (3 environment) | ✅ Ada |
| 7 | Terminal Input + Action Bar | ✅ Ada |
| 8 | Terminal Resize Metadata (PID, cols×rows, updated timestamp) | ✅ Ada |

### 1.2 Fitur yang Tidak Ditemukan / Ambigu

| # | Fitur | Temuan |
|---|-------|--------|
| 1 | Dark / Light mode toggle | ❌ Tidak terdeteksi di DOM |
| 2 | Reconnect button saat disconnected | ❓ Tidak terlihat di state aktif |
| 3 | Multi-pane split view | ❓ Belum ada evidence di DOM |
| 4 | Search / filter terminal list | ❌ Tidak ada |
| 5 | Keyboard shortcut cheatsheet / help modal | ❌ Tidak ada |
| 6 | YOLO mode indicator / warning | ⚠️ Label "YOLO" ada tapi tidak ada visual danger indicator |
| 7 | Toast / notification system | ❓ Tidak terdeteksi |

---

## 2. Temuan QA — Kategorisasi Isu

### Severity Legend

| Label | Arti |
|-------|------|
| 🔴 Critical | Blokir penggunaan utama, wajib fix sebelum release |
| 🟠 Major | Degradasi UX signifikan, fix di sprint berikutnya |
| 🟡 Minor | Gangguan kecil, fix saat ada kapasitas |
| 🔵 Enhancement | Perbaikan pengalaman, tidak blocking |

---

### 2.1 Isu: Information Architecture & Hierarchy

**[QA-001] 🔴 Critical — Urutan konten tidak mencerminkan prioritas mobile**

- **Lokasi:** Seluruh halaman
- **Kondisi saat ini:** Halaman dimulai dengan "Toggle Sidebar" → judul besar → metrik → active terminals → base terminals → agent presets → environment launcher. Urutan ini mengasumsikan pengguna membaca dari atas ke bawah seperti di desktop.
- **Dampak mobile:** Di viewport 375px, pengguna harus scroll 3–4 layar penuh sebelum sampai ke aksi utama (open/launch terminal).
- **Rekomendasi:** Susun ulang layout mobile menjadi: App Bar → Status Strip (ringkas) → Active Terminals (jika ada, ini yang paling penting) → Quick Launch (base terminals + agent presets dalam tab) → Environment detail (bisa collapsible).
- **Acceptance Criteria:** Active terminal pane harus visible dalam 1 scroll di viewport 375px.

---

**[QA-002] 🟠 Major — Metrics strip tidak memprioritaskan informasi penting**

- **Lokasi:** Metrics strip (LIVE PANES: 1, RUNNING: 1, ENVIRONMENTS: 3, AGENT PRESETS: 4)
- **Kondisi saat ini:** 4 metrik ditampilkan dengan bobot visual yang sama, dalam pola yang mirip dengan bento grid horizontal.
- **Dampak mobile:** Di layar kecil, keempat metrik akan membutuhkan horizontal scroll atau wrap yang tidak rapi. Angka "3" dan "4" untuk Environments/Presets kurang actionable dibandingkan "RUNNING: 1".
- **Rekomendasi:** Prioritaskan "RUNNING" dan "LIVE PANES" sebagai KPI utama. "ENVIRONMENTS" dan "AGENT PRESETS" bisa dipindah ke header section masing-masing sebagai badge count.
- **Acceptance Criteria:** Maksimal 2 metrik terlihat di first viewport mobile tanpa scroll horizontal.

---

### 2.2 Isu: Terminal Pane & Action Bar

**[QA-003] 🔴 Critical — Terminal action toolbar terlalu padat dan tidak thumb-friendly**

- **Lokasi:** Active Terminals → toolbar aksi terminal
- **Kondisi saat ini:** Toolbar memiliki ≥12 aksi inline: Close, Terminal input, Interrupt process, Paste from clipboard, Copy selected or latest output, Send enter, Clear terminal, Scroll terminal output up, Scroll to latest output, Tab, ← Move up, Move down, Tab→, Toggle ctrl hold, Ctrl+C.
- **Dampak mobile:** Terlalu banyak aksi berjejer. Aksi destruktif (Close, Interrupt) berdekatan dengan aksi navigasi (Scroll, Tab). Risiko "fat finger" sangat tinggi.
- **Rekomendasi:** Pisahkan toolbar menjadi 3 kelompok:
  - **Primary actions** (sticky bottom bar): Terminal input + Send Enter
  - **Secondary actions** (icon row di atas input): Ctrl+C, Clear, Paste, Copy
  - **Dangerous actions** (context menu / long press): Close, Interrupt process
- **Acceptance Criteria:** Aksi Close dan Interrupt process tidak boleh accessible dalam 1 tap dari area input di mobile.

---

**[QA-004] 🔴 Critical — Terminal input tidak memiliki sticky/fixed positioning**

- **Lokasi:** Active Terminals → `<input aria-label="Terminal input">`
- **Kondisi saat ini:** Input field terminal berada di dalam flow konten normal, sehingga saat keyboard virtual mobile muncul, input bisa terdorong ke area yang susah dijangkau atau tertimpa keyboard.
- **Dampak mobile:** Pengalaman mengetikkan perintah di terminal menjadi frustratif. Ini adalah use case utama halaman ini.
- **Rekomendasi:** Terminal input wajib menggunakan `position: sticky; bottom: 0` atau `position: fixed; bottom: 0` di dalam scroll container terminal. Implementasi harus menangani `window.visualViewport` untuk deteksi keyboard virtual.
- **Acceptance Criteria:** Input terminal tetap visible dan accessible saat virtual keyboard muncul di iOS dan Android.

---

**[QA-005] 🟠 Major — Terminal metadata terlalu verbose untuk tampilan kartu**

- **Lokasi:** Terminal card — `/bin/bash -li`, `PID 3041618`, `41 x 18`, `updated 4/2/2026, 1:08:58 PM`
- **Kondisi saat ini:** Semua metadata teknis (PID, dimensions, shell path, timestamp) ditampilkan setara di kartu terminal.
- **Dampak mobile:** Menghabiskan ruang vertikal yang berharga. PID dan dimensi terminal (cols×rows) jarang dibutuhkan oleh pengguna saat mobile.
- **Rekomendasi:** Tampilkan hanya: nama terminal, status badge (CONNECTED/DISCONNECTED), dan "updated X min ago". Detail PID, dimensi, dan shell path masuk ke expandable details section atau tap-to-expand.
- **Acceptance Criteria:** Terminal card di mobile tidak melebihi 72px tinggi dalam kondisi collapsed.

---

**[QA-006] 🟡 Minor — Tidak ada visual feedback saat terminal sedang typing**

- **Lokasi:** Terminal input area
- **Kondisi saat ini:** Tidak terdeteksi indikator loading/processing setelah submit command.
- **Rekomendasi:** Tambahkan spinner kecil atau disable state pada tombol Send Enter saat command sedang dieksekusi.
- **Acceptance Criteria:** Ada indikator visual selama 200ms–N detik setelah command dikirim.

---

### 2.3 Isu: Base Terminals & Agent Presets

**[QA-007] 🟠 Major — Base Terminals dan Agent Presets tidak memiliki tab/grouping di mobile**

- **Lokasi:** Section "BASE TERMINALS" dan "AGENT PRESETS"
- **Kondisi saat ini:** Kedua section ini ditampilkan sebagai daftar vertikal yang panjang. Base Terminals memiliki 5 item, Agent Presets memiliki 4 item, masing-masing dengan deskripsi, tag, dan badge.
- **Dampak mobile:** Total scroll yang dibutuhkan menjadi sangat panjang. Pengguna yang hanya ingin launch preset tidak perlu melihat semua base terminal, dan sebaliknya.
- **Rekomendasi:** Gabungkan ke dalam satu "Launch Terminal" section dengan **tab pills**: Base Terminals | Agent Presets. Atau gunakan pola accordion/collapsible per section.
- **Acceptance Criteria:** Pengguna bisa mengakses Agent Presets dalam ≤2 tap dari halaman.

---

**[QA-008] 🟠 Major — YOLO mode tidak memiliki visual danger indicator**

- **Lokasi:** Agent Presets — setiap preset menampilkan label "Default YOLO"
- **Kondisi saat ini:** Label "YOLO" hanya ditampilkan sebagai text biasa tanpa styling khusus. YOLO mode biasanya berarti agent dapat mengeksekusi aksi berbahaya (delete, overwrite, dsb.) tanpa konfirmasi.
- **Dampak:** Pengguna baru atau pengguna di mobile bisa meluncurkan preset dengan YOLO mode tanpa sadar risikonya.
- **Rekomendasi:** Gunakan warning badge (`--color-warning` atau oranye) dengan ikon ⚠️ untuk YOLO mode. Tambahkan tooltip/sheet penjelasan saat di-tap.
- **Acceptance Criteria:** YOLO mode badge menggunakan warna warning dan memiliki deskripsi yang muncul saat di-tap.

---

**[QA-009] 🟡 Minor — Agent Preset cards terlalu berat secara visual**

- **Lokasi:** Agent Presets section
- **Kondisi saat ini:** Setiap preset menampilkan: provider badge, nama, deskripsi, "BOUND ENVIRONMENT" label, nama environment, "SKILLS" label, jumlah skill, daftar skill tags, "Default dir", "Default YOLO".
- **Rekomendasi:** Collapsed view: hanya nama preset, provider badge, bound environment. Expanded view: semua detail. Primary CTA tombol "Launch" harus selalu visible.
- **Acceptance Criteria:** Launch button terlihat tanpa expand di setiap preset card.

---

### 2.4 Isu: Environment Launcher

**[QA-010] 🟡 Minor — Environment numbering tidak konsisten**

- **Lokasi:** Environment Launcher section
- **Kondisi saat ini:** "Host Default" diberi nomor 2, "Frontend Workspace" bernomor 3, "Agent Workspace" juga bernomor 3. Dua environment memiliki nomor yang sama (3).
- **Dampak:** Ambigu. Pengguna tidak tahu apa arti angka ini — apakah jumlah key, urutan, atau identifier.
- **Rekomendasi:** Jika angka adalah jumlah parsed keys, gunakan label "2 keys" / "3 keys" daripada angka terisolir. Jika ini adalah ID unik, pastikan tidak ada duplikasi.
- **Acceptance Criteria:** Tidak ada dua environment dengan nomor/identifier yang sama, atau ubah menjadi label deskriptif.

---

**[QA-011] 🟡 Minor — Environment tags tidak memiliki semantic color coding**

- **Lokasi:** Environment cards — tag HOST, DEFAULT, OPS, FRONTEND, NEXTJS, UI, AGENT, RUNTIME
- **Kondisi saat ini:** Semua tag tampak sama secara visual.
- **Rekomendasi:** Berikan color coding semantic: FRONTEND/UI = biru, AGENT/RUNTIME = ungu, HOST/DEFAULT = netral/abu. Ini memudahkan pemindaian cepat.
- **Acceptance Criteria:** Minimal 3 kategori tag memiliki warna yang berbeda.

---

### 2.5 Isu: Navigation & Sidebar

**[QA-012] 🔴 Critical — Tidak ada bottom navigation untuk mobile**

- **Lokasi:** Global navigation
- **Kondisi saat ini:** Navigasi hanya melalui "Toggle Sidebar" di atas. Pola sidebar tidak cocok untuk mobile karena membutuhkan tap di pojok kiri atas, yang merupakan zona paling sulit dijangkau jempol.
- **Dampak mobile:** Satu-satunya aksi navigasi berada di dead zone thumb reach.
- **Rekomendasi:** Di viewport ≤768px, sembunyikan sidebar dan ganti dengan salah satu pola: (a) bottom tab bar jika ada ≤5 halaman utama, atau (b) hamburger menu yang membuka bottom sheet drawer (bukan sidebar dari kiri).
- **Acceptance Criteria:** Di 375px, navigasi utama bisa diakses dari zona thumb reach bawah.

---

**[QA-013] 🟠 Major — Tidak ada breadcrumb atau page context**

- **Lokasi:** Header halaman
- **Kondisi saat ini:** Halaman hanya menampilkan "Terminals" sebagai judul tanpa konteks apakah pengguna ada di sub-section mana.
- **Rekomendasi:** Tambahkan app bar yang konsisten dengan: nama app (VPS Control Room), nama halaman aktif, dan status connection indicator (dot hijau/merah ke VPS).
- **Acceptance Criteria:** Pengguna dapat mengetahui nama halaman aktif dan status koneksi dari satu baris app bar.

---

### 2.6 Isu: Aksesibilitas & Typography

**[QA-014] 🟠 Major — Label uppercase ALL CAPS berpotensi melanggar readability**

- **Lokasi:** Section headers — "LIVE PANES", "RUNNING", "BASE TERMINALS", "AGENT PRESETS", dll.
- **Kondisi saat ini:** Hampir semua label menggunakan uppercase. ALL CAPS dalam jumlah besar menurunkan kecepatan baca dan bisa gagal WCAG readability guidelines.
- **Rekomendasi:** Pertahankan uppercase hanya untuk badge/chip status (CONNECTED, OPEN). Section headers gunakan Title Case atau sentence case. Label kategori di agent preset gunakan small caps CSS (`font-variant: small-caps`) bukan uppercase literal.
- **Acceptance Criteria:** Tidak lebih dari 30% teks di halaman dalam format ALL CAPS.

---

**[QA-015] 🟡 Minor — Font size belum diverifikasi untuk mobile floor**

- **Lokasi:** Seluruh halaman
- **Kondisi saat ini:** Dari DOM, tidak dapat memverifikasi apakah semua text ≥12px dan body text ≥16px.
- **Rekomendasi:** Audit semua elemen teks dengan DevTools. Pastikan: body ≥16px, label metadata ≥12px, tombol ≥14px. Gunakan `clamp()` untuk fluid type scale.
- **Acceptance Criteria:** Tidak ada teks yang render di bawah 12px di viewport 375px.

---

**[QA-016] 🟡 Minor — Touch target belum terverifikasi**

- **Lokasi:** Semua tombol dan aksi interaktif
- **Kondisi saat ini:** Dari DOM content extraction, tidak ada data ukuran pixel eksplisit untuk tombol-tombol di toolbar terminal.
- **Rekomendasi:** Audit menggunakan DevTools atau Axe. Semua interactive element minimum 44×44px sesuai WCAG 2.5.5.
- **Acceptance Criteria:** 100% tombol dan link memiliki tap target ≥44×44px.

---

**[QA-017] 🔵 Enhancement — Tidak ada empty state untuk kondisi 0 terminal aktif**

- **Lokasi:** Active Terminals section
- **Kondisi saat ini:** Saat ini ada 1 terminal aktif. Tidak ada evidence empty state design untuk kondisi 0 terminal.
- **Rekomendasi:** Desain empty state: ilustrasi kecil, teks "No active terminals", CTA "Launch Terminal" yang langsung membuka base terminal launcher.
- **Acceptance Criteria:** Empty state visible dan memiliki CTA yang jelas saat active terminals = 0.

---

## 3. Ringkasan Skor QA

| Dimensi | Skor | Justifikasi |
|---------|------|-------------|
| Information Architecture | 5/10 | Urutan konten tidak mobile-first, tidak ada grouping/tab |
| Mobile Usability | 5/10 | Input tidak sticky, toolbar terlalu padat, tidak ada bottom nav |
| Visual Hierarchy | 6/10 | Metrics strip ada, tapi semua elemen visual weight setara |
| Action Safety | 5/10 | Aksi destruktif berdekatan, YOLO tidak ada warning |
| Accessibility | 6/10 | aria-label ada di input, tapi touch target & contrast belum terverifikasi |
| Feature Completeness | 7/10 | Semua fitur utama ada, beberapa state minor belum tertangani |
| **Overall Mobile Readiness** | **5.6/10** | Butuh perbaikan signifikan sebelum dapat digunakan nyaman di mobile |

---

## 4. Product Requirements — Perbaikan Mobile-First

### 4.1 Layout Architecture (Sprint 1 — Critical)

**PR-001: Responsive Layout System**

Halaman Terminals harus menggunakan CSS layout yang membedakan antara mobile dan desktop secara eksplisit.

```
Mobile (≤768px):
  ┌─────────────────────────────┐
  │  App Bar (status + menu)    │
  ├─────────────────────────────┤
  │  KPI Strip (2 metrik)       │
  ├─────────────────────────────┤
  │  Active Terminals           │
  │  ┌─────────────────────┐    │
  │  │ Terminal Pane       │    │
  │  │ (scrollable output) │    │
  │  └─────────────────────┘    │
  ├─────────────────────────────┤
  │  [Sticky Input + Actions]   │
  ├─────────────────────────────┤
  │  Launch Section (tab pills) │
  │  Base | Presets | Env       │
  └─────────────────────────────┘

Desktop (≥1024px):
  ┌──────┬──────────────────────┐
  │      │  KPI Strip           │
  │ Side │──────────────────────│
  │  bar │  Active Terminals    │
  │      │──────────────────────│
  │      │  Launch Section      │
  └──────┴──────────────────────┘
```

**Acceptance Criteria:**
- [ ] Di 375px, active terminal pane visible tanpa scroll lebih dari 1 layar
- [ ] Di 375px, tidak ada horizontal overflow
- [ ] Di ≥1024px, layout menggunakan sidebar + content area

---

**PR-002: Sticky Terminal Input Bar**

Terminal input harus sticky di bottom viewport saat terminal pane aktif.

```css
.terminal-action-bar {
  position: sticky;
  bottom: 0;
  z-index: 10;
  padding-bottom: env(safe-area-inset-bottom); /* iOS safe area */
}
```

Handling virtual keyboard: gunakan `window.visualViewport.addEventListener('resize', ...)` untuk menyesuaikan bottom offset saat keyboard muncul.

**Acceptance Criteria:**
- [ ] Input tetap visible saat virtual keyboard muncul di iOS Safari dan Android Chrome
- [ ] Input tidak tertimpa system navigation bar
- [ ] Send/Enter button accessible tanpa dismiss keyboard

---

**PR-003: Bottom Navigation (Mobile)**

Ganti sidebar toggle dengan bottom navigation di mobile.

```
┌─────────────────────────────────┐
│  🖥  Terminals  │  📊  Status  │  ⚙️  Settings  │
└─────────────────────────────────┘
```

- Maximum 4 item di bottom bar
- Active state: teal accent + label
- Icon minimum 24×24px, total tap area 44×44px

**Acceptance Criteria:**
- [ ] Bottom nav visible di viewport ≤768px
- [ ] Sidebar tidak muncul di mobile kecuali via sheet drawer
- [ ] Active page terhighlight jelas

---

### 4.2 Terminal Toolbar Redesign (Sprint 1 — Critical)

**PR-004: Grouped Terminal Actions**

Kelompokkan aksi terminal berdasarkan frekuensi dan risiko:

| Grup | Aksi | Penempatan |
|------|------|------------|
| Primary | Input field, Send Enter | Sticky bottom bar, selalu visible |
| Quick | Ctrl+C, Paste, Copy Output | Icon row di atas input |
| Navigation | Scroll Up, Scroll to Latest, Tab←, Tab→ | Collapsible row |
| Dangerous | Interrupt Process, Close Terminal | Context menu (long press / "⋮" button) |

**Acceptance Criteria:**
- [ ] Close dan Interrupt tidak accessible dalam 1 tap dari area input
- [ ] Semua tombol ≥44×44px di mobile
- [ ] Dangerous actions memiliki confirmation dialog ("Are you sure?")

---

### 4.3 Launch Section Redesign (Sprint 2 — Major)

**PR-005: Tab-Based Launch Interface**

Gabungkan Base Terminals, Agent Presets, dan Environment Launcher dalam satu section dengan tab navigation.

```
[ Base Terminals ] [ Agent Presets ] [ Environments ]
┌─────────────────────────────────────────────────┐
│  Codex Ops                         [ Launch ]   │
│  CODEX • Host Default • 3 Skills               │
│  Bound: /opt/vps-control-room                   │
├─────────────────────────────────────────────────┤
│  Claude UI                         [ Launch ]   │
│  CLAUDE • Frontend Workspace • 2 Skills         │
└─────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Semua tab accessible dalam 1 tap
- [ ] Launch button visible di setiap card tanpa expand
- [ ] Expand/collapse detail tersedia via chevron

---

**PR-006: YOLO Mode Warning Badge**

YOLO mode harus menggunakan visual warning yang jelas.

- Badge warna: `--color-warning` (oranye)
- Ikon: ⚠️ atau shield-warning icon dari Lucide
- Tooltip/sheet saat di-tap: "YOLO mode aktif — agent dapat mengeksekusi aksi destruktif tanpa konfirmasi. Pastikan Anda memahami risikonya."
- Default state: opsional collapsible YOLO toggle per preset

**Acceptance Criteria:**
- [ ] YOLO badge menggunakan warna berbeda dari badge status normal
- [ ] Ada penjelasan YOLO yang accessible via 1 tap

---

### 4.4 Metadata & Status System (Sprint 2 — Major)

**PR-007: Terminal Card Compact Mode**

Terminal card di mobile menggunakan collapsed mode secara default.

**Collapsed (default mobile):**
```
┌──────────────────────────────────┐
│ 🟢 Empty Terminal      [⋮] [×]  │
│ SHELL • Connected • 17 min ago  │
└──────────────────────────────────┘
```

**Expanded (tap chevron):**
```
┌──────────────────────────────────┐
│ 🟢 Empty Terminal      [⋮] [×]  │
│ SHELL • Connected • 17 min ago   │
│ ─────────────────────────────── │
│ PID: 3041618  •  41×18          │
│ Shell: /bin/bash -li            │
│ Updated: 4/2/2026, 1:08:58 PM   │
└──────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Collapsed card height ≤72px
- [ ] Expanded/collapsed state persist per session
- [ ] Status badge menggunakan color: hijau=CONNECTED, kuning=RECONNECTING, merah=DISCONNECTED

---

**PR-008: Environment Number Fix**

Perbaiki numbering yang ambigu di Environment Launcher.

- **Saat ini:** Host Default = "2", Frontend Workspace = "3", Agent Workspace = "3" (duplikat!)
- **Rekomendasi:** Ganti angka dengan label jumlah key: "2 keys", "3 keys", "3 keys" — atau assign unique sequential ID.

**Acceptance Criteria:**
- [ ] Tidak ada dua environment yang memiliki identifier yang sama
- [ ] Angka memiliki label kontekstual (misalnya "3 env vars")

---

### 4.5 Aksesibilitas (Sprint 2–3)

**PR-009: Accessibility Compliance**

| Requirement | Standard | Target |
|-------------|----------|--------|
| Touch target size | WCAG 2.5.5 | ≥44×44px semua interactive element |
| Color contrast body text | WCAG AA | ≥4.5:1 |
| Color contrast large text | WCAG AA | ≥3:1 |
| Focus indicator | WCAG 2.4.7 | Visible `:focus-visible` outline |
| Keyboard navigation | WCAG 2.1.1 | Semua aksi bisa via keyboard |
| ARIA labels | WCAG 4.1.2 | Icon-only buttons harus punya aria-label |
| No text below 12px | Design standard | Floor absolute 12px |

**Acceptance Criteria:**
- [ ] Lighthouse Accessibility score ≥ 85
- [ ] Zero critical axe violations

---

### 4.6 Empty & Error States (Sprint 3)

**PR-010: Defensive UI States**

| State | Komponen | Requirement |
|-------|----------|-------------|
| 0 active terminals | Active Terminals section | Empty state dengan ilustrasi + CTA "Launch Terminal" |
| Terminal disconnected | Terminal card | Status badge DISCONNECTED + tombol "Reconnect" yang prominent |
| Environment load error | Environment Launcher | Inline error dengan pesan spesifik |
| Preset launch failure | Agent Presets | Toast error + log detail di expandable area |
| VPS unreachable | Global | Full-page error state dengan retry action |

**Acceptance Criteria:**
- [ ] Setiap state di atas memiliki desain yang didefinisikan
- [ ] Error message menggunakan bahasa manusia, bukan kode teknis
- [ ] Setiap error memiliki minimal 1 recovery action (retry, reconnect, dll.)

---

## 5. Prioritas Implementasi

### Sprint 1 — Critical (1–2 minggu)

1. **PR-001** — Responsive Layout System (mobile vs desktop breakpoint)
2. **PR-002** — Sticky Terminal Input Bar + virtual keyboard handling
3. **PR-003** — Bottom Navigation pengganti sidebar toggle di mobile
4. **PR-004** — Grouped Terminal Actions (pisahkan dangerous actions)

### Sprint 2 — Major (2–3 minggu)

5. **PR-005** — Tab-Based Launch Interface (Base + Presets + Env dalam satu section)
6. **PR-006** — YOLO Mode Warning Badge
7. **PR-007** — Terminal Card Compact Mode
8. **PR-008** — Environment Number Fix
9. **PR-009** — Accessibility Audit & Fixes (touch target, contrast)

### Sprint 3 — Polish (1–2 minggu)

10. **PR-010** — Defensive UI States (empty, disconnected, error)
11. **QA-015** — Font size audit & fluid type scale
12. **QA-014** — Uppercase label audit & reduction
13. **QA-017** — Empty state untuk 0 active terminals

---

## 6. Testing Protocol

### 6.1 Device Matrix

| Device | Viewport | OS | Priority |
|--------|----------|----|----------|
| iPhone SE (3rd gen) | 375×667px | iOS 17 | 🔴 Must test |
| iPhone 14 Pro | 390×844px | iOS 17 | 🔴 Must test |
| Samsung Galaxy S22 | 360×780px | Android 13 | 🔴 Must test |
| iPad (10th gen) | 768×1024px | iPadOS 17 | 🟠 Should test |
| MacBook 13" | 1280×800px | macOS | 🔴 Must test |

### 6.2 Browser Matrix

| Browser | Version | Priority |
|---------|---------|----------|
| Safari iOS | Latest | 🔴 Must test (virtual keyboard behavior berbeda) |
| Chrome Android | Latest | 🔴 Must test |
| Chrome Desktop | Latest | 🔴 Must test |
| Firefox Desktop | Latest | 🟠 Should test |
| Safari macOS | Latest | 🟠 Should test |

### 6.3 Critical User Journeys

**Journey 1: Launch terminal dari mobile**
1. Buka halaman di 375px
2. Lihat active terminal di first viewport
3. Tap terminal pane untuk fokus
4. Ketik command via virtual keyboard
5. Verifikasi input tidak tertimpa keyboard

**Journey 2: Launch Agent Preset baru**
1. Navigate ke Launch section
2. Pilih tab "Agent Presets"
3. Review YOLO warning pada preset
4. Tap Launch
5. Verifikasi terminal baru muncul di Active Terminals

**Journey 3: Multiple terminal management**
1. Launch 2 terminal berbeda
2. Switch antara terminal
3. Close satu terminal via dangerous action menu
4. Verifikasi terminal list terupdate

---

## 7. Out of Scope

Isu-isu berikut **tidak** masuk dalam scope QA ini:

- Performa eksekusi command di backend
- Keamanan koneksi WebSocket ke VPS
- Fungsionalitas CODEX/CLAUDE/GEMINI/OPENCLAW binary
- Manajemen environment variables (create/edit/delete)
- User authentication dan authorization
- Audit trail / logging sistem

---

## 8. Lampiran: Feature Inventory

### 8.1 Base Terminals

| Nama | Provider | Deskripsi |
|------|----------|-----------|
| Empty Terminal | SHELL | Interactive login shell pada VPS host |
| Codex | CODEX | Start a Codex CLI session directly |
| Claude | CLAUDE | Start a Claude CLI session (jika binary terinstall) |
| Gemini | GEMINI | Start a Gemini CLI session (jika binary terinstall) |
| OpenClaw TUI | OPENCLAW | Start OpenClaw dalam interactive mode |

### 8.2 Agent Presets

| Nama | Provider | Bound Environment | Skills |
|------|----------|-------------------|--------|
| Codex Ops | CODEX | Host Default | SKILL-CODER, SYSTEM-CHECK, DOKPLOY-DEPLOY (3) |
| Claude UI | CLAUDE | Frontend Workspace | WEBAPP-DELIVERY, PROJECT-TEMPLATE (2) |
| Gemini Research | GEMINI | Host Default | SYSTEM-CHECK, SKILL-CODER (2) |
| OpenClaw Runtime | OPENAI/GPT-5-NANO / OPENCLAW | Agent Workspace | OPENCLAW-MASTER, SYSTEM-CHECK (2) |

### 8.3 Environments

| Nama | Path | Tags | Parsed Keys |
|------|------|------|-------------|
| Host Default | /opt/vps-control-room | HOST, DEFAULT, OPS | CONTROL_ROOM_ACCESS_MODE, WORKSPACE_ROOT |
| Frontend Workspace | /opt/vps-control-room/frontend | FRONTEND, NEXTJS, UI | APP_SCOPE, NEXT_RUNTIME, PREFERRED_UI_STYLE |
| Agent Workspace | /opt/vps-control-room/agent | AGENT, HOST, RUNTIME | APP_SCOPE, DOCKER_HOST, SYSTEM_ACCESS |

### 8.4 Terminal Toolbar Actions (Lengkap)

| Aksi | Kategori | Risiko |
|------|----------|--------|
| Terminal input | Primary | Rendah |
| Send Enter | Primary | Rendah |
| Ctrl+C | Quick | Rendah |
| Paste from clipboard | Quick | Rendah |
| Copy selected or latest output | Quick | Rendah |
| Clear terminal | Navigation | Rendah |
| Scroll terminal output up | Navigation | Rendah |
| Scroll to latest output | Navigation | Rendah |
| Tab← / Tab→ | Navigation | Rendah |
| Move up / Move down | Navigation | Rendah |
| Toggle ctrl hold | Navigation | Rendah |
| Interrupt process | Dangerous | Tinggi |
| Close terminal | Dangerous | Tinggi |

---

*Dokumen ini dibuat berdasarkan live content extraction dari https://<your-domain>/terminals pada 2 April 2026. Screenshot interaktif tidak tersedia karena keterbatasan browser automation di environment audit ini. Disarankan untuk melakukan usability testing manual dengan device fisik setelah implementasi.*

