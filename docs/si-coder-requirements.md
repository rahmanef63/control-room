# SI Coder — Setup Requirements

Everything needed to run the `si-coder` skill on a fresh VPS or after cloning this repo.

---

## 1. Environment Variables

Set these in `~/.bashrc` (or `~/.zshrc`) on the host machine. Run `source ~/.bashrc` after editing.

```bash
# Dokploy
export DOKPLOY_API_URL="https://<your-dokploy-url>"
export DOKPLOY_API_KEY="<your-dokploy-api-key>"

# GitHub
export GITHUB_TOKEN="github_pat_<your-token>"

# Hostinger (optional — required for automatic DNS setup)
export HOSTINGER_API_TOKEN="<your-hostinger-token>"
```

### Where to get each value

| Variable | Where to get it |
|---|---|
| `DOKPLOY_API_URL` | Your Dokploy server URL (e.g. `https://dokploy.example.com`) |
| `DOKPLOY_API_KEY` | Dokploy → Settings → API Keys → Create |
| `GITHUB_TOKEN` | GitHub → Settings → Developer Settings → Personal access tokens → Fine-grained. Required scopes: **Contents** (read/write), **Metadata** (read), **Administration** (read/write) |
| `HOSTINGER_API_TOKEN` | Hostinger hPanel → Profile → API → Generate Token |

---

## 2. SSH Key for GitHub

The deploy script pushes code via SSH (`git@github.com`). The host must have a key added to GitHub.

```bash
# Check if key exists
ls ~/.ssh/id_ed25519.pub

# Generate if missing
ssh-keygen -t ed25519 -C "your@email.com"

# Copy public key
cat ~/.ssh/id_ed25519.pub

# Paste at: https://github.com/settings/ssh/new

# Test
ssh -T git@github.com
```

---

## 3. Install the Skill

Run the install script from the repo root:

```bash
bash scripts/install-skills.sh
```

This copies `skills/si-coder/` to `~/.agents/skills/si-coder/` so OpenClaw and other agents can discover it.

To install manually:

```bash
mkdir -p ~/.agents/skills
cp -r skills/si-coder ~/.agents/skills/si-coder
```

---

## 4. Node.js

The deploy script runs with `node` directly — no install step needed. Requires **Node.js 18+** (for the native `fetch` API).

```bash
node --version   # must be 18+
```

---

## 5. Dokploy Setup Checklist

Before running a deployment:

- [ ] Dokploy is installed and accessible at `DOKPLOY_API_URL`
- [ ] A GitHub App or OAuth provider is connected in Dokploy → Settings → Providers (optional — falls back to PAT-in-URL)
- [ ] Traefik is running and handling HTTPS (for Let's Encrypt cert generation)
- [ ] The Dokploy server IP is reachable from the internet on ports 80 and 443

---

## 6. Hostinger DNS (optional)

If `HOSTINGER_API_TOKEN` is set, the script automatically creates `A` records for:
- `<domain>` → frontend
- `api-<domain>` → Convex API
- `dash-<domain>` → Convex dashboard
- `site-<domain>` → Convex site

The IP is auto-detected from the Dokploy server URL. No manual DNS step needed.

If the token is not set, create these records manually in Hostinger hPanel → Domains → DNS Zone.

---

## 7. Running a Deployment

```bash
cd ~/projects/<your-app-name>
node ~/.agents/skills/si-coder/scripts/deploy.js \
  "$DOKPLOY_API_URL" \
  "$DOKPLOY_API_KEY" \
  "<project-name>" \
  "<app-name>" \
  "$GITHUB_TOKEN" \
  "<your-domain.com>"
```

### With an AI agent (Claude Code, OpenClaw, etc.)

Just describe what you want to build. The agent reads `SKILL.md` to know the full workflow and runs the script automatically.

Example prompt:
> "Build a Next.js SaaS app with Convex auth and deploy it to Dokploy as `my-saas` on `myapp.example.com`."

---

## 8. What the Script Creates

| Resource | Description |
|---|---|
| GitHub repo | Private repo named `<app-name>` under your GitHub account |
| Dokploy project | Named `<project-name>` |
| Dokploy Compose | `<app-name>-db` — self-hosted Convex (backend + dashboard) |
| Dokploy Application | `<app-name>` — Next.js frontend built from Dockerfile |
| DNS records | `api-`, `dash-`, `site-`, root domain via Hostinger API |
| JWT keys | Auto-generated RSA key pair for `@convex-dev/auth` |
| Convex schema | Auto-deployed via `npx convex deploy` after backend starts |

---

## 9. Security Notes

- `GITHUB_TOKEN` is embedded in the Git remote URL as a fallback when no GitHub provider is connected to Dokploy. This URL is stored in Dokploy's internal database, not in your code. If your Dokploy is self-hosted and private, this is acceptable.
- `DOKPLOY_API_KEY` has full admin access to your Dokploy instance. Treat it like a root password.
- `HOSTINGER_API_TOKEN` can modify all DNS zones in your account. Rotate it if you suspect exposure.
- Never commit any of these values to the repository. The `.env.example` files contain only placeholder strings.

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| `git push` fails | Run `ssh -T git@github.com` — add your SSH key to GitHub if it fails |
| Dokploy API 401 | Check `DOKPLOY_API_KEY` is correct and not expired |
| GitHub API 404 on repo create | Check `GITHUB_TOKEN` has `repo` or `Administration: write` scope |
| Convex schema deploy fails | Wait for backend container to be healthy (may take 30–60s after compose deploy) |
| DNS not propagating | Hostinger DNS changes can take up to 5 minutes |
| "Connection lost while action was in flight" | See `SKILL.md` — usually `NEXT_PUBLIC_CONVEX_URL` embedded wrong at build time |
