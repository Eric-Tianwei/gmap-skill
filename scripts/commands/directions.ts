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

const FIELDS =
  "routes.duration,routes.distanceMeters,routes.description,routes.legs.startLocation,routes.legs.endLocation,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters";

export function register(program: Command): void {
  program
    .command("directions <origin> <destination>")
    .option("-m, --mode <mode>", "driving|walking|bicycling|transit|two_wheeler", "driving")
    .option("--traffic", "request trafficAware routing (driving only)")
    .description("Route between two places (Routes API)")
    .action(
      async (
        origin: string,
        destination: string,
        opts: { mode: string; traffic?: boolean },
      ) => {
        const travelMode = TRAVEL_MODE[opts.mode.toLowerCase()];
        if (!travelMode) fail(`unknown mode: ${opts.mode}`);
        const body: Record<string, unknown> = {
          origin: waypoint(resolveAddress(origin)),
          destination: waypoint(resolveAddress(destination)),
          travelMode,
        };
        if (travelMode === "DRIVE") {
          body.routingPreference = opts.traffic ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE";
        }
        const data = await routesPost("directions/v2:computeRoutes", body, FIELDS);
        const route = data.routes?.[0];
        if (!route) fail("no routes", 2);
        const leg = route.legs?.[0];
        emit({
          description: route.description,
          distance: formatMeters(route.distanceMeters),
          duration: parseDuration(route.duration),
          steps: (leg?.steps ?? []).map((s: any) => ({
            instruction: s.navigationInstruction?.instructions,
            distance: formatMeters(s.distanceMeters),
          })),
        });
      },
    );
}
