import type { Command } from "commander";
import { emit, placesGet, formatMoney, moneyToNumber } from "../client.ts";

const FIELDS = [
  // identity
  "id",
  "displayName",
  "primaryTypeDisplayName",
  "types",
  "businessStatus",
  // contact
  "formattedAddress",
  "internationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "location",
  // quality / price
  "rating",
  "userRatingCount",
  "priceLevel",
  "priceRange",
  "editorialSummary",
  // hours
  "currentOpeningHours",
  "regularOpeningHours",
  // restaurant / food
  "servesBreakfast",
  "servesLunch",
  "servesDinner",
  "servesBrunch",
  "servesDessert",
  "servesCoffee",
  "servesBeer",
  "servesWine",
  "servesCocktails",
  "servesVegetarianFood",
  "menuForChildren",
  "outdoorSeating",
  "liveMusic",
  "reservable",
  "dineIn",
  "takeout",
  "delivery",
  "curbsidePickup",
  // amenities
  "goodForChildren",
  "goodForGroups",
  "goodForWatchingSports",
  "allowsDogs",
  "restroom",
  // ops
  "accessibilityOptions",
  "parkingOptions",
  "paymentOptions",
  // fuel / EV
  "fuelOptions",
  "evChargeOptions",
].join(",");

function compact<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

export function register(program: Command): void {
  program
    .command("details <placeId>")
    .description("Place details (Places API New): hours, price, food/amenity flags, fuel/EV prices")
    .action(async (placeId: string) => {
      const p = await placesGet(placeId, FIELDS);

      const fuel = p.fuelOptions?.fuelPrices?.map((f: any) => ({
        type: f.type,
        price: formatMoney(f.price),
        value: moneyToNumber(f.price),
        currency: f.price?.currencyCode,
        updated: f.updateTime,
      }));

      const ev = p.evChargeOptions
        ? {
            connector_count: p.evChargeOptions.connectorCount,
            connectors: p.evChargeOptions.connectorAggregation?.map((c: any) => ({
              type: c.type,
              max_kw: c.maxChargeRateKw,
              count: c.count,
              available: c.availableCount,
              out_of_service: c.outOfServiceCount,
              updated: c.availabilityLastUpdateTime,
            })),
          }
        : undefined;

      const food = compact({
        breakfast: p.servesBreakfast,
        lunch: p.servesLunch,
        dinner: p.servesDinner,
        brunch: p.servesBrunch,
        dessert: p.servesDessert,
        coffee: p.servesCoffee,
        beer: p.servesBeer,
        wine: p.servesWine,
        cocktails: p.servesCocktails,
        vegetarian: p.servesVegetarianFood,
        kids_menu: p.menuForChildren,
      });

      const service = compact({
        reservable: p.reservable,
        dine_in: p.dineIn,
        takeout: p.takeout,
        delivery: p.delivery,
        curbside_pickup: p.curbsidePickup,
        outdoor_seating: p.outdoorSeating,
        live_music: p.liveMusic,
      });

      const amenities = compact({
        good_for_children: p.goodForChildren,
        good_for_groups: p.goodForGroups,
        good_for_sports: p.goodForWatchingSports,
        allows_dogs: p.allowsDogs,
        restroom: p.restroom,
      });

      emit(
        compact({
          name: p.displayName?.text,
          primary_type: p.primaryTypeDisplayName?.text,
          types: p.types,
          business_status: p.businessStatus,
          address: p.formattedAddress,
          phone: p.internationalPhoneNumber,
          website: p.websiteUri,
          google_maps_url: p.googleMapsUri,
          rating: p.rating,
          user_ratings_total: p.userRatingCount,
          price_level: p.priceLevel,
          price_range: p.priceRange
            ? {
                start: formatMoney(p.priceRange.startPrice),
                end: formatMoney(p.priceRange.endPrice),
              }
            : undefined,
          summary: p.editorialSummary?.text,
          open_now: p.currentOpeningHours?.openNow,
          weekday_text: p.regularOpeningHours?.weekdayDescriptions,
          food,
          service,
          amenities,
          accessibility: p.accessibilityOptions,
          parking: p.parkingOptions,
          payment: p.paymentOptions,
          fuel_prices: fuel,
          ev_charging: ev,
          location: p.location,
        }),
      );
    });
}
