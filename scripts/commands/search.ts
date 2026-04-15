import type { Command } from "commander";
import { emit, placesPost } from "../client.ts";

const FIELDS =
  "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.googleMapsUri,places.websiteUri,places.nationalPhoneNumber,places.currentOpeningHours.openNow";

export function register(program: Command): void {
  program
    .command("search <query>")
    .option("-l, --location <lat,lng>", "bias around a point")
    .option("-r, --radius <meters>", "bias radius in meters (default 5000)", "5000")
    .option("-n, --max <count>", "max results (1–20)", "10")
    .description("Text search for places by natural-language query (Places API New)")
    .action(async (query: string, opts: { location?: string; radius: string; max: string }) => {
      const body: Record<string, unknown> = {
        textQuery: query,
        maxResultCount: Math.min(20, Math.max(1, parseInt(opts.max, 10))),
      };
      if (opts.location) {
        const [lat, lng] = opts.location.split(",").map(Number);
        body.locationBias = {
          circle: { center: { latitude: lat, longitude: lng }, radius: +opts.radius },
        };
      }
      const data = await placesPost("places:searchText", body, FIELDS);
      emit(
        (data.places ?? []).map((p: any) => ({
          name: p.displayName?.text,
          address: p.formattedAddress,
          rating: p.rating,
          user_ratings_total: p.userRatingCount,
          open_now: p.currentOpeningHours?.openNow,
          phone: p.nationalPhoneNumber,
          website: p.websiteUri,
          place_id: p.id,
          google_maps_url: p.googleMapsUri,
          location: p.location,
        })),
      );
    });
}
