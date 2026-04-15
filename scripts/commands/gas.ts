import type { Command } from "commander";
import { emit, placesPost, formatMoney, moneyToNumber } from "../client.ts";

const FIELDS =
  "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.websiteUri,places.fuelOptions";

const FUEL_TYPES = [
  "REGULAR_UNLEADED",
  "MIDGRADE",
  "PREMIUM",
  "DIESEL",
  "DIESEL_PLUS",
  "E85",
  "E80",
  "METHANE",
  "BIO_DIESEL",
  "TRUCK_DIESEL",
  "LPG",
  "SP91",
  "SP91_E10",
  "SP92",
  "SP95",
  "SP95_E10",
  "SP98",
  "SP99",
  "SP100",
];

export function register(program: Command): void {
  program
    .command("gas <location> <radius>")
    .option("-f, --fuel <type>", `fuel type to sort by: ${FUEL_TYPES.join("|")}`, "REGULAR_UNLEADED")
    .option("-n, --max <count>", "max results (1–20)", "10")
    .description('Find gas stations near "lat,lng" within radius meters and compare fuel prices')
    .action(async (location: string, radius: string, opts: { fuel: string; max: string }) => {
      const [lat, lng] = location.split(",").map(Number);
      const body = {
        maxResultCount: Math.min(20, Math.max(1, parseInt(opts.max, 10))),
        includedTypes: ["gas_station"],
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: +radius,
          },
        },
      };
      const data = await placesPost("places:searchNearby", body, FIELDS);
      const wanted = opts.fuel.toUpperCase();
      const rows = (data.places ?? []).map((p: any) => {
        const prices = (p.fuelOptions?.fuelPrices ?? []).map((f: any) => ({
          type: f.type,
          price: formatMoney(f.price),
          value: moneyToNumber(f.price),
          currency: f.price?.currencyCode,
          updated: f.updateTime,
        }));
        const match = prices.find((x: any) => x.type === wanted);
        return {
          name: p.displayName?.text,
          address: p.formattedAddress,
          rating: p.rating,
          user_ratings_total: p.userRatingCount,
          [`${wanted}`]: match?.price ?? null,
          sort_value: match?.value ?? Number.POSITIVE_INFINITY,
          all_prices: prices,
          website: p.websiteUri,
          place_id: p.id,
          google_maps_url: p.googleMapsUri,
          location: p.location,
        };
      });
      rows.sort((a: any, b: any) => a.sort_value - b.sort_value);
      for (const r of rows) delete r.sort_value;
      emit(rows);
    });
}
