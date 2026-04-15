import { resolveApiKey } from "./config.ts";

const ROUTES = "https://routes.googleapis.com";
const PLACES = "https://places.googleapis.com/v1";
const GEOCODE = "https://maps.googleapis.com/maps/api/geocode/json";

export function apiKey(): string {
  const key = resolveApiKey();
  if (!key) {
    fail("No API key. Run `bun run gmap config init` or set GOOGLE_MAPS_API_KEY.");
  }
  return key as string;
}

export function emit(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

export function fail(msg: string, code = 1): never {
  process.stderr.write(JSON.stringify({ error: msg }) + "\n");
  process.exit(code);
}

async function handle(res: Response): Promise<unknown> {
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      (body as { error?: { message?: string } })?.error?.message ||
      `HTTP ${res.status}`;
    fail(msg, 1);
  }
  return body;
}

export async function geocodeApi(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ ...params, key: apiKey() }).toString();
  const res = await fetch(`${GEOCODE}?${qs}`);
  const data = (await handle(res)) as { status: string; error_message?: string; results: unknown[] };
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    fail(`${data.status}: ${data.error_message ?? ""}`);
  }
  return data;
}

export async function routesPost(
  endpoint: "directions/v2:computeRoutes" | "distanceMatrix/v2:computeRouteMatrix",
  body: unknown,
  fieldMask: string,
): Promise<any> {
  const res = await fetch(`${ROUTES}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });
  return handle(res);
}

export async function placesPost(
  endpoint: "places:searchText" | "places:searchNearby",
  body: unknown,
  fieldMask: string,
): Promise<any> {
  const res = await fetch(`${PLACES}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });
  return handle(res);
}

export async function placesGet(placeId: string, fieldMask: string): Promise<any> {
  const res = await fetch(`${PLACES}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": fieldMask,
    },
  });
  return handle(res);
}

// Routes API waypoint helper: accepts "place_id:XXX", "lat,lng", or address string.
export function waypoint(input: string): Record<string, unknown> {
  if (input.startsWith("place_id:")) {
    return { placeId: input.slice("place_id:".length) };
  }
  const m = input.match(/^\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (m) {
    return { location: { latLng: { latitude: +m[1], longitude: +m[2] } } };
  }
  return { address: input };
}

export const TRAVEL_MODE: Record<string, string> = {
  driving: "DRIVE",
  walking: "WALK",
  bicycling: "BICYCLE",
  transit: "TRANSIT",
  two_wheeler: "TWO_WHEELER",
};

export function parseDuration(s: string | undefined): string {
  if (!s) return "";
  const secs = parseInt(s.replace(/s$/, ""), 10);
  if (Number.isNaN(secs)) return s;
  const m = Math.round(secs / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function formatMeters(n: number | undefined): string {
  if (n == null) return "";
  return n >= 1000 ? `${(n / 1000).toFixed(1)} km` : `${n} m`;
}

// google.type.Money → number (returns NaN if missing)
export function moneyToNumber(m: { units?: string | number; nanos?: number } | undefined): number {
  if (!m) return NaN;
  const units = typeof m.units === "string" ? parseInt(m.units, 10) : m.units ?? 0;
  const nanos = m.nanos ?? 0;
  return units + nanos / 1e9;
}

export function formatMoney(m: { units?: string | number; nanos?: number; currencyCode?: string } | undefined): string {
  if (!m) return "";
  const v = moneyToNumber(m);
  if (Number.isNaN(v)) return "";
  return `${v.toFixed(2)} ${m.currencyCode ?? ""}`.trim();
}
