import type { Command } from "commander";
import { emit, fail, geocodeApi } from "../client.ts";
import { resolveAddress } from "../config.ts";

export function register(program: Command): void {
  program
    .command("geocode <address>")
    .description("Address → {lat, lng, formatted_address}")
    .action(async (address: string) => {
      address = resolveAddress(address);
      const data = await geocodeApi({ address });
      const r = data.results[0];
      if (!r) fail("no results", 2);
      emit({
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
        formatted_address: r.formatted_address,
        place_id: r.place_id,
      });
    });
}
