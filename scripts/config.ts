import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";

export type Place = { name: string; address: string };
export type Config = {
  apiKey?: string;
  home?: string;
  work?: string;
  places: Place[];
};

const DIR = process.env.GMAP_CONFIG_DIR ?? join(homedir(), ".config", "gmap-skill");
const FILE = join(DIR, "config.json");

export function configPath(): string {
  return FILE;
}

export function load(): Config {
  if (!existsSync(FILE)) return { places: [] };
  const raw = JSON.parse(readFileSync(FILE, "utf8"));
  return { places: [], ...raw };
}

export function save(cfg: Config): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  chmodSync(FILE, 0o600);
}

export function resolveApiKey(cfg: Config = load()): string | undefined {
  return cfg.apiKey;
}

export function resolveAddress(input: string, cfg: Config = load()): string {
  if (input === "@home" && cfg.home) return cfg.home;
  if (input === "@work" && cfg.work) return cfg.work;
  if (input.startsWith("@")) {
    const p = cfg.places.find((x) => x.name === input.slice(1));
    if (p) return p.address;
  }
  return input;
}
