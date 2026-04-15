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

const FIELDS = "originIndex,destinationIndex,duration,distanceMeters,status,condition";

export function register(program: Command): void {
  program
    .command("matrix")
    .requiredOption("-o, --origins <list>", "semicolon-separated origins")
    .requiredOption("-d, --destinations <list>", "semicolon-separated destinations")
    .option("-m, --mode <mode>", "driving|walking|bicycling|transit|two_wheeler", "driving")
    .option("--traffic", "trafficAware routing (driving only)")
    .description("N×M travel-time / distance matrix (Routes API computeRouteMatrix)")
    .action(async (opts: { origins: string; destinations: string; mode: string; traffic?: boolean }) => {
      const travelMode = TRAVEL_MODE[opts.mode.toLowerCase()];
      if (!travelMode) fail(`unknown mode: ${opts.mode}`);
      const origins = opts.origins.split(";").map((s) => s.trim()).filter(Boolean);
      const dests = opts.destinations.split(";").map((s) => s.trim()).filter(Boolean);
      const body: Record<string, unknown> = {
        origins: origins.map((s) => ({ waypoint: waypoint(resolveAddress(s)) })),
        destinations: dests.map((s) => ({ waypoint: waypoint(resolveAddress(s)) })),
        travelMode,
      };
      if (travelMode === "DRIVE") {
        body.routingPreference = opts.traffic ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE";
      }
      const data = await routesPost("distanceMatrix/v2:computeRouteMatrix", body, FIELDS);
      // Response is an array of elements (may arrive as NDJSON — fetch parses as JSON array when Content-Type is JSON).
      const rows: any[] = Array.isArray(data) ? data : [];
      emit(
        rows.map((e) => ({
          origin: origins[e.originIndex],
          destination: dests[e.destinationIndex],
          duration: parseDuration(e.duration),
          distance: formatMeters(e.distanceMeters),
          condition: e.condition,
          status: e.status,
        })),
      );
    });
}
