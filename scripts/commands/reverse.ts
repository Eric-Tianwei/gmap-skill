import type { Command } from "commander";
import { emit, fail, geocodeApi } from "../client.ts";

export function register(program: Command): void {
  program
    .command("reverse <lat> <lng>")
    .description("lat/lng → address")
    .action(async (lat: string, lng: string) => {
      const data = await geocodeApi({ latlng: `${lat},${lng}` });
      const r = data.results[0];
      if (!r) fail("no results", 2);
      emit({
        formatted_address: r.formatted_address,
        place_id: r.place_id,
        types: r.types,
      });
    });
}
