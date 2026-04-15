import type { Command } from "commander";
import { emit, placesPost } from "../client.ts";

const FIELDS =
  "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.websiteUri,places.businessStatus,places.types,places.primaryType,places.parkingOptions,places.currentOpeningHours.openNow";

// Types that commonly have free customer parking lots (suburban big-box pattern).
const LIKELY_FREE_TYPES = [
  "supermarket",
  "grocery_store",
  "department_store",
  "shopping_mall",
  "home_improvement_store",
  "home_goods_store",
  "hardware_store",
  "furniture_store",
  "wholesaler",
  "gas_station",
  "pharmacy",
  "drugstore",
  "sporting_goods_store",
  "pet_store",
  "discount_store",
];

type Source = "parking_lot" | "inferred";
type Confidence = "confirmed_free" | "likely_free" | "unknown" | "paid";

function classify(po: any, primaryType: string | undefined, source: Source): Confidence {
  if (po) {
    if (po.freeParkingLot || po.freeGarageParking) return "confirmed_free";
    const anyPaid =
      po.paidParkingLot || po.paidGarageParking || po.paidStreetParking;
    const anyFree =
      po.freeParkingLot || po.freeGarageParking || po.freeStreetParking;
    if (anyPaid && !anyFree) return "paid";
    if (po.freeStreetParking) return "likely_free";
  }
  if (source === "parking_lot") return "unknown";
  // Inferred candidate without parkingOptions — type decides.
  if (primaryType && LIKELY_FREE_TYPES.includes(primaryType)) return "likely_free";
  return "unknown";
}

function tags(po: any): string[] {
  if (!po) return [];
  const t: string[] = [];
  if (po.freeParkingLot) t.push("free_lot");
  if (po.paidParkingLot) t.push("paid_lot");
  if (po.freeGarageParking) t.push("free_garage");
  if (po.paidGarageParking) t.push("paid_garage");
  if (po.freeStreetParking) t.push("free_street");
  if (po.paidStreetParking) t.push("paid_street");
  if (po.valetParking) t.push("valet");
  return t;
}

const CONFIDENCE_SCORE: Record<Confidence, number> = {
  confirmed_free: 0,
  likely_free: 10,
  unknown: 30,
  paid: 90,
};

async function searchByTypes(
  lat: number,
  lng: number,
  radius: number,
  types: string[],
  max: number,
) {
  const body = {
    maxResultCount: Math.min(20, max),
    includedTypes: types,
    rankPreference: "DISTANCE",
    locationRestriction: {
      circle: { center: { latitude: lat, longitude: lng }, radius },
    },
  };
  const data = await placesPost("places:searchNearby", body, FIELDS);
  return data.places ?? [];
}

export function register(program: Command): void {
  program
    .command("parking <location> <radius>")
    .option("-n, --max <count>", "max results per source (1–20)", "15")
    .option("--free-only", "only keep confirmed_free / likely_free results")
    .option("--infer", "also include big-box retail / gas stations likely to have free lots")
    .option("--sort <mode>", "confidence|distance (default: confidence)", "confidence")
    .description('Find parking near "lat,lng". With --infer, adds likely-free lots at supermarkets, gas stations, etc.')
    .action(
      async (
        location: string,
        radius: string,
        opts: {
          max: string;
          freeOnly?: boolean;
          infer?: boolean;
          sort: string;
        },
      ) => {
        const [lat, lng] = location.split(",").map(Number);
        const r = +radius;
        const max = Math.min(20, Math.max(1, parseInt(opts.max, 10)));

        const calls: Array<Promise<any[]>> = [
          searchByTypes(lat, lng, r, ["parking"], max),
        ];
        if (opts.infer) {
          calls.push(searchByTypes(lat, lng, r, LIKELY_FREE_TYPES, max));
        }
        const [primary, inferred = []] = await Promise.all(calls);

        const seen = new Set<string>();
        const combined: Array<{ p: any; source: Source }> = [];
        for (const p of primary) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          combined.push({ p, source: "parking_lot" });
        }
        for (const p of inferred) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          combined.push({ p, source: "inferred" });
        }

        let rows = combined.map(({ p, source }) => {
          const dx = (p.location?.latitude ?? lat) - lat;
          const dy = (p.location?.longitude ?? lng) - lng;
          const distM = Math.round(Math.sqrt(dx * dx + dy * dy) * 111_000);
          const confidence = classify(p.parkingOptions, p.primaryType, source);
          return {
            name: p.displayName?.text,
            address: p.formattedAddress,
            distance_m: distM,
            source, // parking_lot | inferred
            primary_type: p.primaryType,
            confidence, // confirmed_free | likely_free | unknown | paid
            parking: tags(p.parkingOptions),
            open_now: p.currentOpeningHours?.openNow,
            business_status: p.businessStatus,
            rating: p.rating,
            user_ratings_total: p.userRatingCount,
            website: p.websiteUri,
            place_id: p.id,
            google_maps_url: p.googleMapsUri,
            location: p.location,
            _score: CONFIDENCE_SCORE[confidence],
          };
        });

        if (opts.freeOnly) {
          rows = rows.filter(
            (r) => r.confidence === "confirmed_free" || r.confidence === "likely_free",
          );
        } else {
          rows = rows.filter((r) => r.confidence !== "paid" || r.source === "parking_lot");
        }

        if (opts.sort === "distance") {
          rows.sort((a, b) => a.distance_m - b.distance_m);
        } else {
          rows.sort((a, b) =>
            a._score !== b._score ? a._score - b._score : a.distance_m - b.distance_m,
          );
        }

        emit({
          note:
            "Google Places does not expose hourly rates. `confirmed_free` = freeParkingLot=true in API; `likely_free` = inferred from place type (supermarket/big-box/gas station). Always verify on-site; some places restrict parking to customers.",
          results: rows.map(({ _score, ...rest }) => rest),
        });
      },
    );
}
