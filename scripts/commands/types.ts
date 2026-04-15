import type { Command } from "commander";
import { emit } from "../client.ts";

// Curated subset of Places API (New) type taxonomy, grouped by everyday need.
// Full list: https://developers.google.com/maps/documentation/places/web-service/place-types
const CATALOG: Record<string, Record<string, string[]>> = {
  food: {
    restaurants: [
      "restaurant",
      "american_restaurant",
      "chinese_restaurant",
      "japanese_restaurant",
      "korean_restaurant",
      "italian_restaurant",
      "french_restaurant",
      "mexican_restaurant",
      "thai_restaurant",
      "vietnamese_restaurant",
      "indian_restaurant",
      "seafood_restaurant",
      "steak_house",
      "sushi_restaurant",
      "ramen_restaurant",
      "pizza_restaurant",
      "hamburger_restaurant",
      "fast_food_restaurant",
      "vegan_restaurant",
      "vegetarian_restaurant",
      "buffet_restaurant",
      "fine_dining_restaurant",
      "barbecue_restaurant",
      "korean_barbecue_restaurant",
    ],
    cafe_sweet: ["cafe", "coffee_shop", "bakery", "dessert_shop", "dessert_restaurant", "ice_cream_shop", "tea_house", "bagel_shop", "donut_shop", "juice_shop"],
    bars: ["bar", "pub", "wine_bar", "night_club", "bar_and_grill"],
  },
  shopping: {
    grocery: ["supermarket", "grocery_store", "convenience_store", "asian_grocery_store", "market", "food_store", "butcher_shop", "liquor_store"],
    retail: ["shopping_mall", "department_store", "clothing_store", "shoe_store", "jewelry_store", "electronics_store", "book_store", "hardware_store", "home_goods_store", "furniture_store", "pet_store", "sporting_goods_store", "toy_store"],
  },
  services: {
    personal: ["hair_salon", "barber_shop", "beauty_salon", "spa", "nail_salon", "massage", "laundry", "dry_cleaner"],
    auto: ["gas_station", "electric_vehicle_charging_station", "car_wash", "car_repair", "car_dealer", "car_rental", "parking"],
    health: ["hospital", "doctor", "dentist", "pharmacy", "drugstore", "physiotherapist", "veterinary_care"],
    money: ["bank", "atm"],
    logistics: ["post_office", "storage"],
    civic: ["public_bathroom", "library", "city_hall", "police", "embassy", "fire_station", "courthouse"],
  },
  leisure: {
    outdoor: ["park", "national_park", "beach", "hiking_area", "campground", "garden", "dog_park", "playground"],
    sightseeing: ["tourist_attraction", "museum", "art_gallery", "monument", "historical_landmark", "cultural_landmark", "zoo", "aquarium", "amusement_park", "observation_deck"],
    entertainment: ["movie_theater", "stadium", "concert_hall", "performing_arts_theater", "casino", "bowling_alley", "karaoke", "amusement_center"],
    fitness: ["gym", "fitness_center", "yoga_studio", "sports_club", "swimming_pool", "golf_course", "ski_resort"],
  },
  travel: {
    lodging: ["hotel", "motel", "resort_hotel", "bed_and_breakfast", "hostel", "extended_stay_hotel", "guest_house", "inn", "lodging"],
    transit: ["airport", "train_station", "subway_station", "bus_station", "bus_stop", "taxi_stand", "ferry_terminal", "light_rail_station", "transit_station"],
  },
  education_work: {
    edu: ["school", "primary_school", "secondary_school", "university", "preschool", "child_care_agency"],
    work: ["corporate_office", "coworking_space"],
  },
};

export function register(program: Command): void {
  program
    .command("types [group]")
    .description("Cheatsheet of Places API includedTypes, grouped by everyday need")
    .action((group?: string) => {
      if (!group) {
        emit(CATALOG);
        return;
      }
      const g = CATALOG[group];
      if (!g) {
        const keys = Object.keys(CATALOG).join(", ");
        process.stderr.write(JSON.stringify({ error: `unknown group "${group}"`, available: keys }) + "\n");
        process.exit(1);
      }
      emit(g);
    });
}
