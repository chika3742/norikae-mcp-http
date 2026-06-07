# 乗換案内MCP 🚃 / Norikae MCP

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

日本の電車乗り換え検索ができるMCP（Model Context Protocol）サーバーです。
Yahoo!乗換案内のデータを使用して、駅から駅への最適なルートを検索できます。
**Cloudflare Workers 上で動作する HTTP（Streamable HTTP）形式のリモート MCP サーバー**です。

*An MCP (Model Context Protocol) server for searching train routes in Japan.
Uses Yahoo! Transit data to find optimal routes between stations.
Runs on **Cloudflare Workers as a remote MCP server over HTTP (Streamable HTTP)**.*

## 機能 / Features

- 🚉 駅から駅への乗り換えルート検索 / Station-to-station route search
- 🔀 経由駅の指定（最大3駅）/ Via station specification (up to 3 stations)
- ⏰ 指定時刻での検索（出発・到着時刻指定）/ Departure or arrival time specification
- 💰 IC運賃の表示 / IC card fare display
- 🔄 乗り換え回数・所要時間の比較 / Transfer count and travel time comparison

## 必要条件 / Requirements

- Cloudflare アカウント（デプロイ用）/ Cloudflare account (for deployment)
- Node.js 18以上（開発・デプロイ用）/ Node.js 18+ (for development & deployment)

## デプロイ / Deployment

このサーバーは Cloudflare Workers にデプロイして使用します。

*This server is deployed to Cloudflare Workers.*

```bash
# 依存関係のインストール / Install dependencies
npm install

# Cloudflare へデプロイ / Deploy to Cloudflare
npm run deploy
```

デプロイ後、`https://<worker-subdomain>.workers.dev/mcp` が MCP エンドポイントになります。

*After deployment, your MCP endpoint will be `https://<worker-subdomain>.workers.dev/mcp`.*

エンドポイント / Endpoint:
- **Streamable HTTP**: `POST https://<worker-subdomain>.workers.dev/mcp`
- 認証なし（authless / 公開）/ No authentication (authless / public)

## 設定 / Configuration

### Claude Desktop での設定 / Claude Desktop Configuration

リモート MCP サーバーへ接続するには `mcp-remote` を利用します。設定ファイルを開いて以下を追加してください：

*Use `mcp-remote` to connect to the remote MCP server. Open the config file and add the following:*

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "norikae": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<worker-subdomain>.workers.dev/mcp"]
    }
  }
}
```

設定後、Claude Desktopを再起動してください。

*After saving, restart Claude Desktop.*

### Streamable HTTP に対応したクライアント / Clients supporting Streamable HTTP

Streamable HTTP トランスポートに直接対応したクライアントでは、URL を指定するだけで接続できます：

*Clients that natively support the Streamable HTTP transport can connect by URL directly:*

```json
{
  "mcpServers": {
    "norikae": {
      "url": "https://<worker-subdomain>.workers.dev/mcp"
    }
  }
}
```

## 使用できるツール / Available Tools

### `search_route`

駅から駅への電車ルートを検索します。

*Search for train routes between stations.*

**パラメータ / Parameters:**

| パラメータ | 型 | 必須 | 説明 / Description |
|-----------|------|------|---------------------|
| `from` | string | ✅ | 出発駅名 / Departure station (e.g., 東京, 新宿) |
| `to` | string | ✅ | 到着駅名 / Arrival station (e.g., 九段下, 横浜) |
| `via` | string[] | - | 経由駅名の配列（最大3駅）/ Via stations array (max 3) |
| `year` | number | - | 出発年 / Year (default: current) |
| `month` | number | - | 出発月 / Month (default: current) |
| `day` | number | - | 出発日 / Day (default: current) |
| `hour` | number | - | 時 / Hour (default: current) |
| `minute` | number | - | 分 / Minute (default: current) |

**検索オプション / Search Options:**

| パラメータ | 型 | デフォルト | 説明 / Description |
|-----------|------|----------|---------------------|
| `timeType` | `departure` \| `arrival` \| `first_train` \| `last_train` \| `unspecified` | `departure` | 時刻指定タイプ / Time type |
| `ticket` | `ic` \| `cash` | `ic` | 運賃タイプ / Fare type |
| `seatPreference` | `non_reserved` \| `reserved` \| `green` | `non_reserved` | 座席指定 / Seat preference |
| `walkSpeed` | `fast` \| `slightly_fast` \| `slightly_slow` \| `slow` | `slightly_slow` | 歩く速度 / Walking speed |
| `sortBy` | `time` \| `transfer` \| `fare` | `time` | 並び順 / Sort order |

**交通手段オプション / Transport Options:**

| パラメータ | 型 | デフォルト | 説明 / Description |
|-----------|------|----------|---------------------|
| `useAirline` | boolean | `true` | 空路を使う / Use airlines |
| `useShinkansen` | boolean | `true` | 新幹線を使う / Use Shinkansen |
| `useExpress` | boolean | `true` | 有料特急を使う / Use express trains |
| `useHighwayBus` | boolean | `true` | 高速バスを使う / Use highway buses |
| `useLocalBus` | boolean | `true` | 路線バスを使う / Use local buses |
| `useFerry` | boolean | `true` | フェリーを使う / Use ferries |

## 使用例（自然言語 → オプション）/ Usage Examples (Natural Language → Options)

AIに以下のように話しかけると、自動的に適切なオプションが設定されます。

*When you ask the AI in natural language, the appropriate options are automatically set.*

### 基本的な検索 / Basic Search

| あなたの質問 / Your Question | 認識されるオプション / Recognized Options |
|------------------------------|------------------------------------------|
| 「東京から九段下まで」 | `from: 東京`, `to: 九段下` |
| 「新宿から横浜への行き方」 | `from: 新宿`, `to: 横浜` |
| "How to get from Tokyo to Shibuya" | `from: 東京`, `to: 渋谷` |
| "Route from Shinjuku to Yokohama" | `from: 新宿`, `to: 横浜` |

### 経由駅の指定 / Via Stations

| あなたの質問 / Your Question | 認識されるオプション / Recognized Options |
|------------------------------|------------------------------------------|
| 「東京から新宿まで、表参道経由で」 | `from: 東京`, `to: 新宿`, `via: ["表参道"]` |
| 「渋谷から池袋、原宿と新宿を経由して」 | `from: 渋谷`, `to: 池袋`, `via: ["原宿", "新宿"]` |
| 「品川から上野、東京駅と秋葉原を通って」 | `from: 品川`, `to: 上野`, `via: ["東京", "秋葉原"]` |
| "From Tokyo to Shinjuku via Omotesando" | `from: 東京`, `to: 新宿`, `via: ["表参道"]` |
| "Shibuya to Ikebukuro, passing through Harajuku and Shinjuku" | `from: 渋谷`, `to: 池袋`, `via: ["原宿", "新宿"]` |

### 時刻指定 / Time Specification

| あなたの質問 / Your Question | 認識されるオプション / Recognized Options |
|------------------------------|------------------------------------------|
| 「10時30分に出発」 | `hour: 10`, `minute: 30` |
| 「朝8時の電車」 | `hour: 8` |
| 「明日の朝9時」 | `day: (tomorrow)`, `hour: 9` |
| "Departing at 10:30 AM" | `hour: 10`, `minute: 30` |
| "Train at 8 in the morning" | `hour: 8` |

### 到着時刻指定 / Arrival Time (timeType)

| あなたの質問 / Your Question | 認識されるオプション / Recognized Options |
|------------------------------|------------------------------------------|
| 「18時に着きたい」 | `timeType: arrival`, `hour: 18` |
| 「9時の会議に間に合うように」 | `timeType: arrival`, `hour: 9` |
| "I want to arrive by 6 PM" | `timeType: arrival`, `hour: 18` |
| "Need to be there for a 9 AM meeting" | `timeType: arrival`, `hour: 9` |

### 始発・終電 / First/Last Train (timeType)

| あなたの質問 / Your Question | 認識されるオプション / Recognized Options |
|------------------------------|------------------------------------------|
| 「始発で」 | `timeType: first_train` |
| 「一番早い電車」 | `timeType: first_train` |
| 「終電で帰りたい」 | `timeType: last_train` |
| 「最終電車は？」 | `timeType: last_train` |
| "First train of the day" | `timeType: first_train` |
| "Last train home" | `timeType: last_train` |

### 座席指定 / Seat Preference (seatPreference)

| あなたの質問 / Your Question | 認識されるオプション / Recognized Options |
|------------------------------|------------------------------------------|
| 「自由席で」 | `seatPreference: non_reserved` (default) |
| 「指定席で」 | `seatPreference: reserved` |
| 「グリーン車で」 | `seatPreference: green` |
| 「贅沢にグリーン車で」 | `seatPreference: green` |
| "Non-reserved seat" | `seatPreference: non_reserved` |
| "Reserved seat please" | `seatPreference: reserved` |
| "Green car / first class" | `seatPreference: green` |

### 運賃タイプ / Fare Type (ticket)

| あなたの質問 / Your Question | 認識されるオプション / Recognized Options |
|------------------------------|------------------------------------------|
| 「IC運賃で」 | `ticket: ic` (default) |
| 「きっぷの値段で」 | `ticket: cash` |
| 「Suicaで」 | `ticket: ic` |
| "Using IC card" | `ticket: ic` |
| "Cash fare please" | `ticket: cash` |

### 歩く速度 / Walking Speed (walkSpeed)

| あなたの質問 / Your Question | 認識されるオプション / Recognized Options |
|------------------------------|------------------------------------------|
| 「急いでるので早歩きで」 | `walkSpeed: fast` |
| 「ゆっくり歩きたい」 | `walkSpeed: slow` |
| 「足が悪いのでゆっくり」 | `walkSpeed: slow` |
| "I'm in a hurry, fast walking" | `walkSpeed: fast` |
| "Walking slowly, I have luggage" | `walkSpeed: slow` |

### 並び順 / Sort Order (sortBy)

| あなたの質問 / Your Question | 認識されるオプション / Recognized Options |
|------------------------------|------------------------------------------|
| 「一番早いルート」 | `sortBy: time` (default) |
| 「一番安いルート」 | `sortBy: fare` |
| 「乗り換え少ないのがいい」 | `sortBy: transfer` |
| "Fastest route" | `sortBy: time` |
| "Cheapest route" | `sortBy: fare` |
| "Fewest transfers" | `sortBy: transfer` |

### 交通手段の除外 / Excluding Transport Types

| あなたの質問 / Your Question | 認識されるオプション / Recognized Options |
|------------------------------|------------------------------------------|
| 「新幹線を使わないで」 | `useShinkansen: false` |
| 「在来線だけで」 | `useShinkansen: false`, `useExpress: false` |
| 「バスは乗りたくない」 | `useHighwayBus: false`, `useLocalBus: false` |
| "Without Shinkansen" | `useShinkansen: false` |
| "Local trains only" | `useShinkansen: false`, `useExpress: false` |
| "No buses please" | `useHighwayBus: false`, `useLocalBus: false` |

### 組み合わせ例 / Combined Examples

**例1 / Example 1: 出張で節約したい / Budget business trip**
```
「明日の朝10時までに東京から大阪に着きたい、新幹線なしで、一番安いルートで」
"I need to arrive in Osaka from Tokyo by 10 AM tomorrow, without Shinkansen, cheapest route"
```
→ `from: 東京`, `to: 大阪`, `timeType: arrival`, `hour: 10`, `useShinkansen: false`, `sortBy: fare`

**例2 / Example 2: 観光でゆっくり / Leisurely sightseeing**
```
「京都から奈良まで、ゆっくり歩きで」
"From Kyoto to Nara, walking slowly"
```
→ `from: 京都`, `to: 奈良`, `walkSpeed: slow`

**例3 / Example 3: 急いでいる / In a hurry**
```
「今すぐ渋谷から羽田空港、最速で、早歩きで」
"Right now from Shibuya to Haneda Airport, fastest route, fast walking"
```
→ `from: 渋谷`, `to: 羽田空港`, `sortBy: time`, `walkSpeed: fast`

**例4 / Example 4: 複雑な条件 / Complex conditions**
```
「来週の金曜日、18時に品川に着くように新宿から、新幹線と飛行機は使わないで、乗り換え少ない順で」
"Next Friday, arriving at Shinagawa by 6 PM from Shinjuku, no Shinkansen or planes, fewest transfers"
```
→ `from: 新宿`, `to: 品川`, `timeType: arrival`, `hour: 18`, `useShinkansen: false`, `useAirline: false`, `sortBy: transfer`

**例5 / Example 5: 経由駅を指定 / Specifying via stations**
```
「東京から新宿まで、表参道と飯田橋を経由して、一番安いルートで」
"From Tokyo to Shinjuku via Omotesando and Iidabashi, cheapest route"
```
→ `from: 東京`, `to: 新宿`, `via: ["表参道", "飯田橋"]`, `sortBy: fare`

**例6 / Example 6: 観光ルート / Sightseeing route**
```
「浅草から原宿まで、上野と秋葉原と東京を通って、ゆっくり歩きで」
"From Asakusa to Harajuku, passing through Ueno, Akihabara, and Tokyo, walking slowly"
```
→ `from: 浅草`, `to: 原宿`, `via: ["上野", "秋葉原", "東京"]`, `walkSpeed: slow`

## 開発 / Development

```bash
# リポジトリをクローン / Clone the repository
git clone https://github.com/YOUR_USERNAME/norikae-mcp.git
cd norikae-mcp

# 依存関係のインストール / Install dependencies
npm install

# ローカル開発サーバー起動 / Start local dev server (wrangler dev)
npm run dev
# → http://localhost:8787/mcp

# 型チェック / Type check
npm run type-check

# テスト実行 / Run tests
npm test

# Cloudflare へデプロイ / Deploy to Cloudflare
npm run deploy
```

ローカル起動後は MCP Inspector でも疎通確認できます：

*After starting locally, you can also verify with the MCP Inspector:*

```bash
npx @modelcontextprotocol/inspector
# Transport: Streamable HTTP / URL: http://localhost:8787/mcp
```

## 技術詳細 / Technical Details

- MCP SDK: `@modelcontextprotocol/sdk`
- MCP ハンドラ / MCP handler: `agents` (`createMcpHandler`)
- トランスポート / Transport: Streamable HTTP (ステートレス / stateless, `/mcp`)
- データソース / Data source: Yahoo!乗換案内 (transit.yahoo.co.jp)
- ランタイム / Runtime: Cloudflare Workers

## 注意事項 / Notes

- このMCPはYahoo!乗換案内のWebページをスクレイピングしています
  *This MCP scrapes Yahoo! Transit web pages*
- 個人利用を想定しています
  *Intended for personal use*
- Yahoo! JAPANの利用規約をご確認ください
  *Please check Yahoo! JAPAN's terms of service*
- リアルタイムの遅延情報は含まれない場合があります
  *Real-time delay information may not be included*

## ライセンス / License

MIT
