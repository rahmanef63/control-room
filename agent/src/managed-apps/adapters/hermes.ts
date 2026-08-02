import { CliManagedAppAdapter } from "./base.js";

export const hermesAdapter = new CliManagedAppAdapter({
  id: "hermes",
  name: "Hermes",
  description: "Hermes Agent runtime and dashboard",
  command: "hermes",
  serviceNames: ["hermes-dashboard.service", "hermes.service"],
  containerNames: ["hermes", "hermes-dashboard"],
  dashboardUrl: process.env.HERMES_DASHBOARD_URL ?? "http://127.0.0.1:9119",
});
