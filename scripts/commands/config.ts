import type { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { emit, fail } from "../client.ts";
import { load, save, configPath } from "../config.ts";

export function register(program: Command): void {
  const config = program.command("config").description("Manage local config");

  config
    .command("init")
    .description("Interactive first-time setup")
    .action(async () => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const ask = async (q: string, def?: string) => {
        const hint = def ? ` [${def}]` : "";
        const a = (await rl.question(`${q}${hint}: `)).trim();
        return a || def || "";
      };
      const cfg = load();
      cfg.apiKey = await ask("Google Maps API key", cfg.apiKey);
      cfg.home = await ask("Home address", cfg.home);
      cfg.work = await ask("Work address", cfg.work);
      rl.close();
      save(cfg);
      process.stderr.write(`Saved to ${configPath()}\n`);
      emit({ ok: true, path: configPath() });
    });

  config
    .command("set <key> <value>")
    .description("Set api_key | home | work")
    .action((key: string, value: string) => {
      const cfg = load();
      const map: Record<string, keyof typeof cfg> = {
        api_key: "apiKey",
        apiKey: "apiKey",
        home: "home",
        work: "work",
      };
      const field = map[key];
      if (!field) fail(`unknown key: ${key}`);
      (cfg as Record<string, unknown>)[field] = value;
      save(cfg);
      emit({ ok: true, [field]: value });
    });

  config
    .command("show")
    .description("Show current config (API key redacted)")
    .action(() => {
      const cfg = load();
      emit({
        path: configPath(),
        apiKey: cfg.apiKey ? `${cfg.apiKey.slice(0, 6)}…${cfg.apiKey.slice(-4)}` : null,
        home: cfg.home ?? null,
        work: cfg.work ?? null,
        places: cfg.places,
      });
    });

  const place = config.command("place").description("Manage saved places");

  place
    .command("add <name> <address>")
    .description("Save a place (reference later as @name)")
    .action((name: string, address: string) => {
      const cfg = load();
      cfg.places = cfg.places.filter((p) => p.name !== name);
      cfg.places.push({ name, address });
      save(cfg);
      emit({ ok: true, name, address });
    });

  place
    .command("rm <name>")
    .description("Remove a saved place")
    .action((name: string) => {
      const cfg = load();
      const before = cfg.places.length;
      cfg.places = cfg.places.filter((p) => p.name !== name);
      if (cfg.places.length === before) fail(`no place named ${name}`);
      save(cfg);
      emit({ ok: true, removed: name });
    });

  place
    .command("list")
    .description("List saved places")
    .action(() => emit(load().places));
}
