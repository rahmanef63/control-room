// Kept in sync with MIN_SECRET_LEN in @/shared/auth/session. Inlined (not
// imported) so the instrumentation hook — which Next also compiles for the Edge
// runtime — does not pull the Node-only crypto module into the Edge bundle.
const MIN_SECRET_LEN = 32;

// Runs once at server startup (Next.js instrumentation hook). Surfaces a loud,
// fail-fast error if the auth secrets are misconfigured, instead of the app
// silently booting with a forgeable/empty signing key.
//
// Only CONTROL_ROOM_SESSION_SECRET (the cookie SIGNING key) must be >= 32 chars
// — a short/empty signing key is forgeable, and the login route refuses to
// issue sessions under it. The login PASSWORD (CONTROL_ROOM_SECRET) may be
// short/memorable on purpose, because approved-device is the strong second
// factor; the login route compares it verbatim and never length-checks it. So
// we only fatal on the signing key, and just note a missing password.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const sessionSecret = process.env.CONTROL_ROOM_SESSION_SECRET ?? '';
  if (sessionSecret.length < MIN_SECRET_LEN) {
    // eslint-disable-next-line no-console
    console.error(
      `[auth] FATAL: CONTROL_ROOM_SESSION_SECRET is missing or shorter than ${MIN_SECRET_LEN} chars. ` +
        `Session signing will reject all requests. Generate with: openssl rand -hex 32`
    );
  }

  if (!(process.env.CONTROL_ROOM_SECRET ?? '')) {
    // eslint-disable-next-line no-console
    console.warn(
      '[auth] CONTROL_ROOM_SECRET (login password) is not set — login will reject every attempt.'
    );
  }
}
