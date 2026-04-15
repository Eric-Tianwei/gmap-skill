---
name: gmap-skill
description: Use this skill whenever the user's task touches real-world locations — finding places, planning trips/commutes/errands, estimating travel time or distance, comparing options nearby, resolving addresses ↔ coordinates, or any "where is / how do I get to / what's near" question. Also applicable to scheduling tasks that need drive-time estimates, itinerary planning, meeting-point selection, delivery/ops routing, real-estate/location research, and similar. Invoke the `gmap` CLI in `scripts/` to call Google Maps Platform (Geocoding, Places, Directions).
---

# gmap-skill

一个本地 TypeScript CLI（基于 Bun），把 Google Maps Platform 的常用能力打包成子命令。**本 skill 的主要内容就是告诉你如何使用这个 CLI** —— 任何涉及到现实地点、路径、耗时、邻近搜索的用户请求，都应优先用它来完成。

底层用的是 **Routes API** 和 **Places API (New)**（非 legacy Directions / Distance Matrix / Places），直接 `fetch` 调用，不依赖官方 SDK。

## 何时使用

只要问题里出现下列任一特征，就考虑调用：
- 地点/地址/坐标（"XX 在哪"、"把这个地址转成坐标"、"这个经纬度是哪里"）
- 路径/导航/通勤（"从 A 到 B 多久"、"最优路线"、"地铁 vs 开车"）
- 邻近/候选（"附近的 X"、"方圆 N 米内的 Y"、"最近的 5 家"）
- 规划/决策（"哪里开会最公平"、"顺路办完 A/B/C"、"这批订单怎么排"）
- 现实空间推理（房源调研、门店选址、配送、旅行安排、排期判断是否来得及）

对这些场景，不要编造距离/时间——**调用 CLI 拿真实数据**。

## 典型组合套路

大多数任务是几个子命令的串联。常见流程：

| 目标 | 命令链 |
|------|--------|
| "我家附近最近的 N 家 X，顺带营业时间和车程" | `search` 或 `nearby` → `details`（并行）→ `matrix`（一把拿全部车程） |
| "从公司去开会来不来得及" | `directions @work "<会议地址>" --traffic`（按需换 `-m transit`） |
| "三个人聚会定在哪最公平" | 每人 `geocode` → 取中点 → `search` 餐厅 → `matrix`（origins=三人, destinations=候选店） |
| "顺路跑腿" | 所有点 `geocode` → `matrix` 拿全员成对耗时 → 贪心/TSP 选顺序 |
| "这张照片 GPS 是哪儿" | `reverse <lat> <lng>` |

## Setup

Node 依赖放在 `scripts/` 下（skill 根目录只有 `SKILL.md`）：

```bash
cd scripts && bun install
```

运行时用 **Bun**（原生 TS，无需编译）。

## 首次配置

```bash
bun run gmap config init
```

交互式写入 `~/.config/gmap-skill/config.json`（权限 0600），包含 API key、home、work。

API key 优先级：环境变量 `GOOGLE_MAPS_API_KEY` > 配置文件。

配置出来后，`geocode` / `directions` 可以直接用别名：`@home`、`@work`、`@<place名>`。

```bash
bun run gmap config show                       # 查看（key 脱敏）
bun run gmap config set home "123 Main St"
bun run gmap config place add gym "456 Gym Ave"
bun run gmap config place list
bun run gmap config place rm gym
```

## 命令速查

所有命令都会把结果以 JSON 打到 stdout，失败时 stderr 打 `{"error": "..."}` 并非零退出。

```bash
bun run gmap <subcommand> [args]
# 或：bun cli.ts <subcommand> [args]
```

### `geocode <address>`
地址 → `{lat, lng, formatted_address, place_id}`。支持别名 `@home` / `@work` / `@<place>`。

```bash
bun run gmap geocode "1600 Amphitheatre Parkway, Mountain View"
bun run gmap geocode @home
```

### `reverse <lat> <lng>`
坐标 → 格式化地址。

```bash
bun run gmap reverse 37.4224 -122.0842
```

### `search <query> [-l lat,lng] [-r radius_m] [-n max]`
自然语言搜索（Places API New — `places:searchText`）。`-n` 上限 20。

```bash
bun run gmap search "pizza near Stanford University"
bun run gmap search "coffee" -l 37.4224,-122.0842 -r 1000 -n 5
```

### `nearby "<lat,lng>" <radius_m> [-t types] [-n max] [-r POPULARITY|DISTANCE]`
按坐标+半径筛选（Places API New — `places:searchNearby`）。坐标合成单参数以避开负数被当 flag。

```bash
bun run gmap nearby "37.4224,-122.0842" 500 -t cafe,restaurant -r DISTANCE
bun run gmap nearby "34.0944,-118.1565" 2000 -t supermarket,convenience_store
bun run gmap nearby "34.0944,-118.1565" 3000 -t bar,night_club
bun run gmap nearby "34.0944,-118.1565" 2000 -t public_bathroom
bun run gmap nearby "34.0944,-118.1565" 5000 -t museum,tourist_attraction
bun run gmap nearby "34.0944,-118.1565" 3000 -t hair_salon,barber_shop
```

不确定类型名时先查 `types` 速查表（见下）。

### `types [group]`
输出 Places API `includedTypes` 速查表，按日常场景分组。不传参数列全部组；传组名（`food` / `shopping` / `services` / `leisure` / `travel` / `education_work`）列该组细类。

```bash
bun run gmap types              # 全部分组
bun run gmap types food         # 只看餐饮类
bun run gmap types services     # 理发/加油/药店/洗手间 等
```

**常用映射速记**：
| 想找 | `-t` 值 |
|------|---------|
| 加油站 | `gas_station` |
| 超市 | `supermarket` / `grocery_store` |
| 甜品店 | `dessert_shop` / `ice_cream_shop` / `bakery` |
| 酒吧 | `bar` / `pub` / `wine_bar` / `night_club` |
| 咖啡 | `cafe` / `coffee_shop` |
| 公厕 | `public_bathroom` |
| 公园 | `park` / `national_park` |
| 博物馆 | `museum` / `art_gallery` |
| 电影院 | `movie_theater` |
| 理发 | `hair_salon` / `barber_shop` |
| 景点 | `tourist_attraction` |
| 酒店 | `hotel` / `motel` / `hostel` |
| 地铁 | `subway_station` / `transit_station` |
| 健身房 | `gym` / `fitness_center` |
| 医院/药店 | `hospital` / `pharmacy` / `drugstore` |

自然语言（"附近好吃的甜品店"）直接用 `search` 更灵活；类型名精确过滤用 `nearby`。

### `details <placeId>`
地点详情，按类型返回不同字段（Places API New）。输出自动裁掉空字段。

**通用**：`primary_type`、`types`、`business_status`、`address`、`phone`、`website`、`google_maps_url`、`rating`、`user_ratings_total`、`summary`、`open_now`、`weekday_text`、`accessibility`、`parking`、`payment`、`location`

**餐厅/咖啡馆**：
- `price_level`（`INEXPENSIVE` / `MODERATE` / `EXPENSIVE` / `VERY_EXPENSIVE`）
- `price_range`（精确人均区间，带货币；较新字段、覆盖不全）
- `food`：`breakfast` / `lunch` / `dinner` / `brunch` / `dessert` / `coffee` / `beer` / `wine` / `cocktails` / `vegetarian` / `kids_menu`
- `service`：`reservable` / `dine_in` / `takeout` / `delivery` / `curbside_pickup` / `outdoor_seating` / `live_music`
- `amenities`：`good_for_children` / `good_for_groups` / `good_for_sports` / `allows_dogs` / `restroom`

**加油站**：`fuel_prices`（每种油品价格+更新时间）

**充电桩**：`ev_charging.connector_count` + `connectors[]`（类型、最大功率 kW、数量、可用/故障数）

**酒店**：⚠️ Places API (New) **不提供官方星级**（"4-star hotel"）——那是 Google 的 Hotel Content API（Travel Partner 专属产品）。可用的是 `rating`（用户评分 1–5）、`user_ratings_total`、`price_level`、`summary`。

```bash
bun run gmap details ChIJ-8IP043EwoARxu4-KUQ-XYM
```

### `gas "<lat,lng>" <radius_m> [-f fuel] [-n max]`
附近加油站+各油品实时价格，按选定油品升序排。`-f` 默认 `REGULAR_UNLEADED`，其它可选：`MIDGRADE`、`PREMIUM`、`DIESEL`、`E85`、`SP95` 等。

```bash
bun run gmap gas "34.0944995,-118.1565464" 3000
bun run gmap gas "34.0944995,-118.1565464" 5000 -f DIESEL -n 15
```

### `parking "<lat,lng>" <radius_m> [-n max] [--free-only] [--infer] [--sort confidence|distance]`
附近停车候选，按 `confidence` 排序（平手按距离）。每条有 `confidence` 标签：

| 标签 | 含义 |
|------|------|
| `confirmed_free` | Google 元数据里 `freeParkingLot: true` 或 `freeGarageParking: true` |
| `likely_free` | 类型强提示（超市/仓储/home improvement/加油站…）且无付费冲突，或元数据含 `freeStreetParking` |
| `unknown` | 无元数据且类型不典型 |
| `paid` | 明确付费，默认只在正规停车场结果里保留，推断类结果过滤掉 |

**`--infer` 关键开关**：并行再搜一把"通常带免费大停车场"的类型——`supermarket` / `grocery_store` / `department_store` / `shopping_mall` / `home_improvement_store` / `home_goods_store` / `hardware_store` / `furniture_store` / `wholesaler` / `gas_station` / `pharmacy` / `drugstore` / `sporting_goods_store` / `pet_store` / `discount_store`，合并去重。市区外 / 社区商业区特别有效。

```bash
bun run gmap parking "34.0522,-118.2437" 800                    # 只搜正规停车场
bun run gmap parking "34.0944,-118.1565" 2000 --infer           # 加推断候选
bun run gmap parking @work 500 --free-only --infer              # 只要免费 / 推测免费
bun run gmap parking "34.0944,-118.1565" 1500 --infer --sort distance
```

⚠️ **Google Places 不提供停车费率**（$/小时），也**不索引街边车位**——`freeStreetParking` 只是目的地元数据，不是可搜索实体。精确费率/实时空位得用 SpotHero / ParkMobile / 市政 feed。**推断的 `likely_free` 需现场确认**，部分大型零售严格限制只给消费者停车（Costco、Trader Joe's 高峰期常见）。

### `ev "<lat,lng>" <radius_m> [-c connector] [-k min_kw] [-n max]`
附近充电桩，显示接口类型（Tesla/CCS1/CCS2/CHAdeMO/J1772/Type2/NACS…）、最大功率、可用数、故障数。按功率降序。

```bash
bun run gmap ev "34.0944995,-118.1565464" 5000
bun run gmap ev "34.0944995,-118.1565464" 10000 -c EV_CONNECTOR_TYPE_CCS_COMBO_1 -k 150
```

### `directions <origin> <destination> [-m mode] [--traffic] [--depart <time>]`
两点路线（**Routes API** — `directions/v2:computeRoutes`）。`mode` ∈ `driving | walking | bicycling | transit | two_wheeler`。起止接受地址、`lat,lng`、`place_id:...`、或别名。

- `--traffic`：按当前路况算（仅 driving）
- `--depart <time>`：按**未来出发时间**预测车程（基于历史路况，Google 自动走 `TRAFFIC_AWARE`）。格式：ISO 8601（`"2026-04-15T08:00-07:00"`）或相对（`"+30m"` / `"+2h"` / `"+1d"` / `"+90s"`）。仅 driving / two_wheeler。

返回多给一个 `duration_no_traffic`（`staticDuration`）作对照，可判断堵车影响。

```bash
bun run gmap directions @home @work --traffic                     # 现在出发
bun run gmap directions @home @work --depart "+30m"               # 半小时后出发
bun run gmap directions @home "LAX" --depart "2026-04-15T06:30-07:00"  # 周一早班飞机
bun run gmap directions "SFO" "Palo Alto" -m transit              # 公交（不用 depart）
```

### `forecast <origin> <destination> [--step 15m] [--horizon 3h] [-m mode]`
预测从现在开始未来 N 小时内车程随时间的变化曲线。内部按 `--step` 步长并行打 `computeRoutes`，拼出时间→车程表。最多 48 个采样点（防 API 爆单）。

输出包含：最快/最慢出发时间、完整采样点，每个点带 `extra_vs_free`（比无路况慢多少分钟，负数表示预测更快）。

```bash
bun run gmap forecast @home @work --step 15m --horizon 2h       # 下班前 2h，每 15 分钟一个点
bun run gmap forecast @home "LAX" --step 30m --horizon 6h       # 看看今天什么时候去机场最快
```

用途：决定什么时候出门避开高峰。

### `matrix -o <origins> -d <destinations> [-m mode] [--traffic] [--depart <time>]`
N×M 行程矩阵（Routes API — `distanceMatrix/v2:computeRouteMatrix`）。`-o` / `-d` 用分号分隔多个点。支持 `--depart`（同 `directions`）。

```bash
bun run gmap matrix \
  -o "@home;@work" \
  -d "SFO;OAK;SJC" \
  -m driving --depart "+1d"     # 明天同一时间出发的车程矩阵
```

取代 legacy Distance Matrix，一次请求拿全部组合。批量场景（最近 N 家车程、多人聚会选址、对比明早不同时段）用这个而不是循环 `directions`。

### `config <init|set|show|place …>`
见上文「首次配置」。

## 使用建议

1. **先看是否已有别名**：用户说"从家去..."优先用 `@home`，而不是再问地址。必要时用 `config place list` 查。
2. **自然语言查地点用 `search`** —— 比先 `geocode` 再 `nearby` 省一步，且能跨区域匹配。精确限定区域时用 `nearby`。
3. **距离/耗时必须经 `directions` 或 `matrix`**，不要用直线距离（Haversine）估算通勤时间；但用 Haversine 在 `search`/`nearby` 结果里做二次"按距离排序"是合理的。
4. **`search` vs `nearby` 怎么选**：
   - 用户说的是**自然语言**（"附近好吃的甜品店"、"24 小时药店"、"便宜泰餐"）→ `search`，能混合类型+语义+修饰词，灵活。
   - 用户想要的是**明确单一或多个类型**（"所有加油站"、"附近所有酒吧"、"最近的公厕"）→ `nearby -t`，可多选（`-t bar,pub,wine_bar`），结果干净且能按 `DISTANCE` 排。
   - 不确定类型名时先 `bun run gmap types [group]` 查速查表，不要猜。
5. **批量耗时查询用 `matrix`**，不要循环 `directions`——一次请求、一次计费、省延迟。
6. **涉及营业时间、电话、网站、价位、油价、充电桩功率时调 `details`**，`search`/`nearby` 只给基本信息；`details` 可多个 place_id 并行调。
7. **返回结果前把 `formatted_address` 回显**给用户确认，尤其重名地点（"Main St"、"王府井"）。
8. **需要实时路况时加 `--traffic`**（仅 driving）；要准时到达的场景总是加上。**未来出发**（预订航班、明早通勤、周末出游）用 `--depart "+2h"` 或 ISO 时间戳，Google 会基于历史交通预测，比 `--traffic` 更准。`--depart` 自动启用 TRAFFIC_AWARE，不需要同时加 `--traffic`。
9. **失败处理**：检查 exit code；常见错误是 API 未在 Cloud Console 启用、key 限制太严、配额超限。把原始错误给用户看，不要静默。

## 项目结构

```
gmap-skill/
├── SKILL.md                ← 本文件
└── scripts/
    ├── package.json / tsconfig.json
    ├── cli.ts              ← 入口，注册所有子命令
    ├── client.ts           ← Google Maps client + emit/fail helpers
    ├── config.ts           ← 配置读写 + 别名解析
    └── commands/
        ├── geocode.ts
        ├── reverse.ts
        ├── search.ts
        ├── nearby.ts
        ├── details.ts
        ├── directions.ts
        ├── matrix.ts
        ├── gas.ts
        ├── ev.ts
        └── config.ts
```

加新命令：在 `commands/` 下新建文件，export `register(program)`，然后在 `cli.ts` 的数组里加一行。
