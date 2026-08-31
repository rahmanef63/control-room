import { execFileSync } from 'node:child_process';

/**
 * Normalize deploy-provided Git SHAs without truncating human release labels.
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeBuildId(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  return /^[0-9a-f]{13,64}$/i.test(trimmed) ? trimmed.slice(0, 12) : trimmed;
}

/**
 * One deterministic build id for SvelteKit version polling, /api/version and
 * the service-worker cache namespace. Deploys may provide PUBLIC_BUILD_ID;
 * otherwise use the same common CI/Dokploy commit variables as the Next app,
 * then fall back to the checked-out Git commit.
 * @param {Record<string, string | undefined>} [env]
 * @param {string} [cwd]
 * @returns {string}
 */
export function resolveBuildId(env = process.env, cwd = process.cwd()) {
  for (const key of ['PUBLIC_BUILD_ID', 'GITHUB_SHA', 'COMMIT_SHA', 'DOKPLOY_COMMIT_SHA']) {
    const resolved = normalizeBuildId(env[key]);
    if (resolved) return resolved;
  }

  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return 'dev';
  }
}
