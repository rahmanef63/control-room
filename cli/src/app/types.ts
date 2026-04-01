export interface CommandArgs {
  _: string[];
  flags: Record<string, string | boolean>;
}
