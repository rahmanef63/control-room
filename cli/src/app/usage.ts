export function usage(): void {
  console.log(`vpsctl - VPS Control Room terminal client\n
Required env:
  CONVEX_URL
  CONVEX_ADMIN_KEY

Commands:
  vpsctl status
  vpsctl apps list
  vpsctl agents list
  vpsctl events list [--limit 20]
  vpsctl action run <action> --target-type <type> --target-id <id> [--lines 100] [--wait]
  vpsctl commands list [--limit 20]
  vpsctl tui [--interval 3]

Examples:
  vpsctl status
  vpsctl action run container.restart --target-type container --target-id n8n --wait
  vpsctl action run container.logs --target-type container --target-id n8n --lines 200 --wait
  vpsctl tui --interval 2
`);
}
