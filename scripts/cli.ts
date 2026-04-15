#!/usr/bin/env bun
import { Command } from "commander";
import { fail } from "./client.ts";
import { register as geocode } from "./commands/geocode.ts";
import { register as reverse } from "./commands/reverse.ts";
import { register as details } from "./commands/details.ts";
import { register as search } from "./commands/search.ts";
import { register as nearby } from "./commands/nearby.ts";
import { register as directions } from "./commands/directions.ts";
import { register as matrix } from "./commands/matrix.ts";
import { register as gas } from "./commands/gas.ts";
import { register as ev } from "./commands/ev.ts";
import { register as config } from "./commands/config.ts";

const program = new Command();
program.name("gmap").description("Google Maps CLI (Routes + Places New)").version("0.2.0");

for (const r of [geocode, reverse, details, search, nearby, directions, matrix, gas, ev, config]) {
  r(program);
}

program.parseAsync().catch((e) => fail(e?.message ?? String(e)));
