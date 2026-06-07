import { createMcpHandler } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { buildYahooTransitUrl, extractMainContent } from './yahoo';

// input schema for search_route
const searchRouteSchema = {
  from: z.string().describe('出発駅名 / Departure station (例: 東京, Shinjuku)'),
  to: z.string().describe('到着駅名 / Arrival station (例: 横浜, Shibuya)'),
  via: z.array(z.string()).optional().describe('経由駅名の配列（最大3駅）/ Via stations array (max 3)'),
  year: z.number().optional().describe('出発年 / Year (例: 2026)'),
  month: z.number().optional().describe('出発月 / Month (1-12)'),
  day: z.number().optional().describe('出発日 / Day (1-31)'),
  hour: z.number().optional().describe('出発時刻の時 / Hour (0-23)'),
  minute: z.number().optional().describe('出発時刻の分 / Minute (0-59)'),
  timeType: z.enum(['departure', 'arrival', 'first_train', 'last_train', 'unspecified']).optional().describe('時刻指定タイプ / Time type: departure=出発時刻、arrival=到着時刻、first_train=始発、last_train=終電、unspecified=指定なし'),
  ticket: z.enum(['ic', 'cash']).optional().describe('運賃タイプ / Fare type: ic=IC運賃、cash=きっぷ運賃'),
  seatPreference: z.enum(['non_reserved', 'reserved', 'green']).optional().describe('座席指定 / Seat preference: non_reserved=自由席優先、reserved=指定席優先、green=グリーン車優先'),
  walkSpeed: z.enum(['fast', 'slightly_fast', 'slightly_slow', 'slow']).optional().describe('歩く速度 / Walking speed'),
  sortBy: z.enum(['time', 'transfer', 'fare']).optional().describe('並び順 / Sort by: time=到着が早い順、transfer=乗換回数順、fare=料金安い順'),
  useAirline: z.boolean().optional().describe('空路を使う / Use airlines'),
  useShinkansen: z.boolean().optional().describe('新幹線を使う / Use Shinkansen'),
  useExpress: z.boolean().optional().describe('有料特急を使う / Use express trains'),
  useHighwayBus: z.boolean().optional().describe('高速バスを使う / Use highway buses'),
  useLocalBus: z.boolean().optional().describe('路線バスを使う / Use local buses'),
  useFerry: z.boolean().optional().describe('フェリーを使う / Use ferries'),
};

// register search_route tool
const toolDescription = `Search train routes between stations in Japan using Yahoo! Transit.

IMPORTANT: Station names MUST be in Japanese kanji/kana. Convert before calling:

English → Japanese:
- Tokyo → 東京, Shinjuku → 新宿, Shibuya → 渋谷, Ikebukuro → 池袋
- Ueno → 上野, Akihabara → 秋葉原, Ginza → 銀座, Roppongi → 六本木
- Yokohama → 横浜, Osaka → 大阪, Kyoto → 京都
- Narita Airport → 成田空港, Haneda Airport → 羽田空港

Chinese (Simplified/Traditional) → Japanese kanji:
- 东京/東京 → 東京, 新宿 → 新宿, 涩谷/澀谷 → 渋谷
- 秋叶原/秋葉原 → 秋葉原, 横滨/橫濱 → 横浜
Note: Japanese kanji may differ from Chinese hanzi (e.g., 渋 vs 涩/澀, 横 vs 横/橫)

Examples:
- "Tokyo to Shinjuku" → from: "東京", to: "新宿"
- "从东京到新宿" → from: "東京", to: "新宿"
- "Shibuya to Ikebukuro via Harajuku" → from: "渋谷", to: "池袋", via: ["原宿"]

Options summary:
- timeType: departure(出発), arrival(到着), first_train(始発), last_train(終電), unspecified(指定なし)
- ticket: ic(ICカード), cash(きっぷ)
- seatPreference: non_reserved(自由席), reserved(指定席), green(グリーン車)
- walkSpeed: fast(急いで), slightly_fast(少し急いで), slightly_slow(少しゆっくり), slow(ゆっくり)
- sortBy: time(到着が早い順), transfer(乗換回数順), fare(料金安い順)
- useAirline, useShinkansen, useExpress, useHighwayBus, useLocalBus, useFerry: true/false`;

// usage instructions registered as an MCP prompt
const usagePromptText = `# 乗換案内MCP 使用ガイド / Norikae MCP Usage Guide

## 重要 / Important
- 駅名は必ず日本語（漢字・かな）で入力してください
- Station names MUST be in Japanese kanji/kana
- Convert English AND Chinese station names to Japanese before calling

## 英語→日本語 / English → Japanese
| English | Japanese |
|---------|----------|
| Tokyo | 東京 |
| Shinjuku | 新宿 |
| Shibuya | 渋谷 |
| Ikebukuro | 池袋 |
| Ueno | 上野 |
| Akihabara | 秋葉原 |
| Ginza | 銀座 |
| Roppongi | 六本木 |
| Harajuku | 原宿 |
| Yokohama | 横浜 |
| Osaka | 大阪 |
| Kyoto | 京都 |
| Narita Airport | 成田空港 |
| Haneda Airport | 羽田空港 |

## 中国語→日本語 / Chinese → Japanese
Japanese kanji may differ from Chinese hanzi:
| 简体/繁體 | 日本語 |
|-----------|--------|
| 东京/東京 | 東京 |
| 涩谷/澀谷 | 渋谷 |
| 秋叶原/秋葉原 | 秋葉原 |
| 横滨/橫濱 | 横浜 |

## 使用例 / Usage Examples
User: "How do I get from Tokyo to Shinjuku?"
→ Call search_route with: from="東京", to="新宿"

User: "東京から渋谷まで表参道経由で"
→ Call search_route with: from="東京", to="渋谷", via=["表参道"]`;

/**
 * Create a fresh McpServer instance per request.
 *
 * createMcpHandler runs the server statelessly, and the MCP SDK warns against
 * sharing a single server/transport across clients (responses can leak between
 * them), so we build a new instance for every incoming request.
 */
function createServer(): McpServer {
  const server = new McpServer({
    name: 'norikae-mcp',
    version: '0.2.0',
  });

  // register prompt for usage instructions
  server.registerPrompt(
    'norikae-usage',
    {
      description: 'Instructions for using the Japanese train route search tool',
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: usagePromptText,
          },
        },
      ],
    })
  );

  server.registerTool(
    'search_route',
    {
      title: '乗り換え検索',
      description: toolDescription,
      inputSchema: searchRouteSchema,
      annotations: {
        readOnlyHint: true,    // data is only read, not modified
        openWorldHint: true,   // interacts with external service (Yahoo)
      },
    },
    async (args) => {
      const {
        from, to, via, year, month, day, hour, minute,
        timeType, ticket, seatPreference, walkSpeed, sortBy,
        useAirline, useShinkansen, useExpress, useHighwayBus, useLocalBus, useFerry,
      } = args;

      // default to current time if not specified
      const now = new Date();
      const y = year ?? now.getFullYear();
      const m = month ?? now.getMonth() + 1;
      const d = day ?? now.getDate();
      const hh = hour ?? now.getHours();
      const mm = minute ?? now.getMinutes();

      // limit via stations to max 3
      const viaStations = via?.slice(0, 3) ?? [];

      const options = {
        timeType: timeType ?? 'departure',
        ticket: ticket ?? 'ic',
        seatPreference: seatPreference ?? 'non_reserved',
        walkSpeed: walkSpeed ?? 'slightly_slow',
        sortBy: sortBy ?? 'time',
        useAirline: useAirline ?? true,
        useShinkansen: useShinkansen ?? true,
        useExpress: useExpress ?? true,
        useHighwayBus: useHighwayBus ?? true,
        useLocalBus: useLocalBus ?? true,
        useFerry: useFerry ?? true,
      };

      const url = buildYahooTransitUrl(from, to, viaStations, y, m, d, hh, mm, options);

      try {
        const response = await fetch(url);
        const html = await response.text();
        const content = extractMainContent(html);

        return {
          content: [{ type: 'text', text: content }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `エラーが発生しました: ${error}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}

// Cloudflare Workers entry point — stateless Streamable HTTP MCP server on /mcp
export default {
  fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    return createMcpHandler(createServer(), { route: '/mcp' })(request, env, ctx);
  },
};
