import type { Command } from "commander";
import { emit, placesPost } from "../client.ts";

const FIELDS =
  "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.types";

export function register(program: Command): void {
  program
    .command("nearby <location> <radius>")
    .option("-t, --types <csv>", "includedTypes (comma-separated)")
    .option("-n, --max <count>", "max results (1–20)", "10")
    .option("-r, --rank <pref>", "POPULARITY|DISTANCE", "POPULARITY")
    .description('Search places near "lat,lng" within radius meters (Places API New, by types). For keyword, use `search`.')
    .action(
      async (
        location: string,
        radius: string,
        opts: { types?: string; max: string; rank: string },
      ) => {
        const [lat, lng] = location.split(",").map(Number);
        const body: Record<string, unknown> = {
          maxResultCount: Math.min(20, Math.max(1, parseInt(opts.max, 10))),
          rankPreference: opts.rank.toUpperCase(),
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: +radius,
            },
          },
        };
        if (opts.types) {
          body.includedTypes = opts.types.split(",").map((s) => s.trim()).filter(Boolean);
        }
        const data = await placesPost("places:searchNearby", body, FIELDS);
        emit(
          (data.places ?? []).map((p: any) => ({
            name: p.displayName?.text,
            address: p.formattedAddress,
            rating: p.rating,
            user_ratings_total: p.userRatingCount,
            types: p.types,
            place_id: p.id,
            location: p.location,
          })),
        );
      },
    );
}
