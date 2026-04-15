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
```

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

### `ev "<lat,lng>" <radius_m> [-c connector] [-k min_kw] [-n max]`
附近充电桩，显示接口类型（Tesla/CCS1/CCS2/CHAdeMO/J1772/Type2/NACS…）、最大功率、可用数、故障数。按功率降序。

```bash
bun run gmap ev "34.0944995,-118.1565464" 5000
bun run gmap ev "34.0944995,-118.1565464" 10000 -c EV_CONNECTOR_TYPE_CCS_COMBO_1 -k 150
```

### `directions <origin> <destination> [-m mode] [--traffic]`
两点路线（**Routes API** — `directions/v2:computeRoutes`）。`mode` ∈ `driving | walking | bicycling | transit | two_wheeler`。起止接受地址、`lat,lng`、`place_id:...`、或别名。`--traffic` 仅 driving 有效。

```bash
bun run gmap directions "SFO" "Palo Alto" -m driving --traffic
bun run gmap directions @home @work
bun run gmap directions @home "place_id:ChIJ-8IP043EwoARxu4-KUQ-XYM"
```

### `matrix -o <origins> -d <destinations> [-m mode] [--traffic]`
N×M 行程矩阵（Routes API — `distanceMatrix/v2:computeRouteMatrix`）。`-o` / `-d` 用分号分隔多个点。

```bash
bun run gmap matrix \
  -o "@home;@work" \
  -d "SFO;OAK;SJC" \
  -m driving --traffic
```

取代 legacy Distance Matrix，一次请求拿全部组合。批量场景（最近 N 家车程、多人聚会选址）用这个而不是循环 `directions`。

### `config <init|set|show|place …>`
见上文「首次配置」。

## 使用建议

1. **先看是否已有别名**：用户说"从家去..."优先用 `@home`，而不是再问地址。必要时用 `config place list` 查。
2. **自然语言查地点用 `search`** —— 比先 `geocode` 再 `nearby` 省一步，且能跨区域匹配。精确限定区域时用 `nearby`。
3. **距离/耗时必须经 `directions` 或 `matrix`**，不要用直线距离（Haversine）估算通勤时间；但用 Haversine 在 `search`/`nearby` 结果里做二次"按距离排序"是合理的。
4. **批量耗时查询用 `matrix`**，不要循环 `directions`——一次请求、一次计费、省延迟。
5. **涉及营业时间、电话、网站时调 `details`**，`search`/`nearby` 只给基本信息；`details` 可多个 place_id 并行调。
6. **返回结果前把 `formatted_address` 回显**给用户确认，尤其重名地点（"Main St"、"王府井"）。
7. **需要实时路况时加 `--traffic`**（仅 driving）；要准时到达的场景总是加上。
8. **失败处理**：检查 exit code；常见错误是 API 未在 Cloud Console 启用、key 限制太严、配额超限。把原始错误给用户看，不要静默。

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
