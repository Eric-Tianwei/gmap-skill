import type { Command } from "commander";
import {
  emit,
  fail,
  routesPost,
  waypoint,
  TRAVEL_MODE,
  parseDuration,
  formatMeters,
} from "../client.ts";
import { resolveAddress } from "../config.ts";

const FIELDS = "routes.duration,routes.staticDuration,routes.distanceMeters";

// Parse "15m" / "2h" / "90s" / "1d" → milliseconds.
function parseInterval(s: string): number {
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(s|m|min|h|hr|d)$/i);
  if (!m) fail(`invalid interval: ${s} (use "15m"/"2h"/"1d"/"90s")`);
  const n = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  return u === "s"
    ? n * 1000
    : u === "h" || u === "hr"
    ? n * 3_600_000
    : u === "d"
    ? n * 86_400_000
    : n * 60_000;
}

function durationSec(s: string | undefined): number {
  if (!s) return NaN;
  return parseInt(s.replace(/s$/, ""), 10);
}

export function register(program: Command): void {
  program
    .command("forecast <origin> <destination>")
    .option("-m, --mode <mode>", "driving|two_wheeler", "driving")
    .option("--step <interval>", "time between samples", "15m")
    .option("--horizon <interval>", "how far into the future to sample", "3h")
    .description("Predict how traffic changes over the next horizon (parallel computeRoutes calls)")
    .action(
      async (
        origin: string,
        destination: string,
        opts: { mode: string; step: string; horizon: string },
      ) => {
        const travelMode = TRAVEL_MODE[opts.mode.toLowerCase()];
        if (travelMode !== "DRIVE" && travelMode !== "TWO_WHEELER") {
          fail("forecast only supports driving / two_wheeler");
        }
        const stepMs = parseInterval(opts.step);
        const horizonMs = parseInterval(opts.horizon);
        const samples = Math.floor(horizonMs / stepMs) + 1;
        if (samples < 2) fail("horizon must be >= step");
        if (samples > 48) fail("too many samples (max 48); widen --step or shrink --horizon");

        const origin_wp = waypoint(resolveAddress(origin));
        const destination_wp = waypoint(resolveAddress(destination));
        const base = Date.now() + 60_000; // +1min to satisfy "must be future"
        const times = Array.from({ length: samples }, (_, i) =>
          new Date(base + i * stepMs).toISOString(),
        );

        const results = await Promise.all(
          times.map(async (t) => {
            const data = await routesPost(
              "directions/v2:computeRoutes",
              {
                origin: origin_wp,
                destination: destination_wp,
                travelMode,
                routingPreference: "TRAFFIC_AWARE",
                departureTime: t,
              },
              FIELDS,
            );
            const r = data.routes?.[0];
            const trafficSec = durationSec(r?.duration);
            const staticSec = durationSec(r?.staticDuration);
            return {
              departure_time: t,
              duration: parseDuration(r?.duration),
              duration_no_traffic: parseDuration(r?.staticDuration),
              traffic_sec: trafficSec,
              static_sec: staticSec,
              delta_min:
                !Number.isNaN(trafficSec) && !Number.isNaN(staticSec)
                  ? Math.round((trafficSec - staticSec) / 60)
                  : null,
              distance: formatMeters(r?.distanceMeters),
            };
          }),
        );

        const valid = results.filter((r) => !Number.isNaN(r.traffic_sec));
        const best = valid.reduce((a, b) => (b.traffic_sec < a.traffic_sec ? b : a), valid[0]);
        const worst = valid.reduce((a, b) => (b.traffic_sec > a.traffic_sec ? b : a), valid[0]);

        emit({
          origin,
          destination,
          samples: results.length,
          step: opts.step,
          horizon: opts.horizon,
          best: best && { time: best.departure_time, duration: best.duration },
          worst: worst && { time: worst.departure_time, duration: worst.duration },
          points: results.map((r) => ({
            t: r.departure_time,
            duration: r.duration,
            extra_vs_free:
              r.delta_min == null
                ? null
                : r.delta_min > 0
                ? `+${r.delta_min} min`
                : `${r.delta_min} min`,
          })),
        });
      },
    );
}
