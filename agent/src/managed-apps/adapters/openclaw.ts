import { CliManagedAppAdapter } from "./base.js";

export const openclawAdapter = new CliManagedAppAdapter({
  id: "openclaw",
  name: "OpenClaw",
  description: "OpenClaw runtime and local control surface",
  command: "openclaw",
  serviceNames: ["openclaw.service", "openclaw-gateway.service"],
  containerNames: ["openclaw", "openclaw-gateway"],
  dashboardUrl: process.env.OPENCLAW_DASHBOARD_URL ?? "http://127.0.0.1:18789",
});
