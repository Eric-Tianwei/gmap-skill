import type { Command } from "commander";
import { emit, placesPost } from "../client.ts";

const FIELDS =
  "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.websiteUri,places.evChargeOptions";

const CONNECTORS = [
  "EV_CONNECTOR_TYPE_TESLA",
  "EV_CONNECTOR_TYPE_CCS_COMBO_1",
  "EV_CONNECTOR_TYPE_CCS_COMBO_2",
  "EV_CONNECTOR_TYPE_CHADEMO",
  "EV_CONNECTOR_TYPE_J1772",
  "EV_CONNECTOR_TYPE_TYPE_2",
  "EV_CONNECTOR_TYPE_OTHER",
  "EV_CONNECTOR_TYPE_UNSPECIFIED_WALL_OUTLET",
  "EV_CONNECTOR_TYPE_UNSPECIFIED_GB_T",
];

export function register(program: Command): void {
  program
    .command("ev <location> <radius>")
    .option("-c, --connector <type>", `filter/sort by connector: ${CONNECTORS.join("|")}`)
    .option("-k, --min-kw <n>", "minimum maxChargeRateKw")
    .option("-n, --max <count>", "max results (1–20)", "10")
    .description('Find EV charging stations near "lat,lng"; shows connector types, power, availability')
    .action(
      async (
        location: string,
        radius: string,
        opts: { connector?: string; minKw?: string; max: string },
      ) => {
        const [lat, lng] = location.split(",").map(Number);
        const body = {
          maxResultCount: Math.min(20, Math.max(1, parseInt(opts.max, 10))),
          includedTypes: ["electric_vehicle_charging_station"],
          rankPreference: "DISTANCE",
          locationRestriction: {
            circle: { center: { latitude: lat, longitude: lng }, radius: +radius },
          },
        };
        const data = await placesPost("places:searchNearby", body, FIELDS);
        const wantConn = opts.connector?.toUpperCase();
        const minKw = opts.minKw ? +opts.minKw : 0;

        const rows = (data.places ?? [])
          .map((p: any) => {
            const aggs = (p.evChargeOptions?.connectorAggregation ?? []).map((c: any) => ({
              type: c.type,
              max_kw: c.maxChargeRateKw,
              count: c.count,
              available: c.availableCount,
              out_of_service: c.outOfServiceCount,
              updated: c.availabilityLastUpdateTime,
            }));
            const match = wantConn ? aggs.find((a: any) => a.type === wantConn) : undefined;
            return {
              name: p.displayName?.text,
              address: p.formattedAddress,
              rating: p.rating,
              user_ratings_total: p.userRatingCount,
              total_connectors: p.evChargeOptions?.connectorCount,
              connectors: aggs,
              match,
              website: p.websiteUri,
              place_id: p.id,
              google_maps_url: p.googleMapsUri,
              location: p.location,
            };
          })
          .filter((r: any) => {
            if (wantConn && !r.match) return false;
            const kw = r.match?.max_kw ?? Math.max(0, ...r.connectors.map((c: any) => c.max_kw ?? 0));
            return kw >= minKw;
          });

        // Sort: if connector specified, by its max_kw desc; else by overall max_kw desc
        rows.sort((a: any, b: any) => {
          const ka = a.match?.max_kw ?? Math.max(0, ...a.connectors.map((c: any) => c.max_kw ?? 0));
          const kb = b.match?.max_kw ?? Math.max(0, ...b.connectors.map((c: any) => c.max_kw ?? 0));
          return kb - ka;
        });

        emit(rows);
      },
    );
}
