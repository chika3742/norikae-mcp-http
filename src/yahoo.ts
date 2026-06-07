// Pure Yahoo! Transit helpers — no Workers/agents imports so this module can be
// unit-tested in plain Node (vitest) and reused by the Worker entry point.

export interface SearchOptions {
  timeType: 'departure' | 'arrival' | 'first_train' | 'last_train' | 'unspecified';
  ticket: 'ic' | 'cash';
  seatPreference: 'non_reserved' | 'reserved' | 'green';
  walkSpeed: 'fast' | 'slightly_fast' | 'slightly_slow' | 'slow';
  sortBy: 'time' | 'transfer' | 'fare';
  useAirline: boolean;
  useShinkansen: boolean;
  useExpress: boolean;
  useHighwayBus: boolean;
  useLocalBus: boolean;
  useFerry: boolean;
}

export function buildYahooTransitUrl(
  from: string,
  to: string,
  via: string[],
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  options: SearchOptions
): string {
  // map options to Yahoo URL parameters
  // type: 1=出発, 4=到着, 3=始発, 2=終電, 5=指定なし
  const timeTypeMap = { departure: '1', arrival: '4', first_train: '3', last_train: '2', unspecified: '5' };
  // ticket: ic=ICカード優先, normal=現金（きっぷ）優先
  const ticketMap = { ic: 'ic', cash: 'normal' };
  // expkind: 1=自由席優先, 2=指定席優先, 3=グリーン車優先
  const seatPreferenceMap = { non_reserved: '1', reserved: '2', green: '3' };
  // ws: 1=急いで, 2=少し急いで, 3=少しゆっくり, 4=ゆっくり
  const walkSpeedMap = { fast: '1', slightly_fast: '2', slightly_slow: '3', slow: '4' };
  // s: 0=到着が早い順, 1=料金が安い順, 2=乗換回数順
  const sortByMap = { time: '0', fare: '1', transfer: '2' };

  const params = new URLSearchParams({
    from: from,
    to: to,
    y: year.toString(),
    m: month.toString().padStart(2, '0'),
    d: day.toString().padStart(2, '0'),
    hh: hour.toString(),
    m1: Math.floor(minute / 10).toString(),
    m2: (minute % 10).toString(),
    type: timeTypeMap[options.timeType],
    ticket: ticketMap[options.ticket],
    expkind: seatPreferenceMap[options.seatPreference],
    ws: walkSpeedMap[options.walkSpeed],
    s: sortByMap[options.sortBy],
    al: options.useAirline ? '1' : '0',
    shin: options.useShinkansen ? '1' : '0',
    ex: options.useExpress ? '1' : '0',
    hb: options.useHighwayBus ? '1' : '0',
    lb: options.useLocalBus ? '1' : '0',
    sr: options.useFerry ? '1' : '0',
  });

  // add via stations (multiple via params supported)
  for (const station of via) {
    params.append('via', station);
  }

  return `https://transit.yahoo.co.jp/search/result?${params.toString()}`;
}

// decode the handful of HTML entities that appear in visible text
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// strip all tags and collapse whitespace to plain text
function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

// format a single <div class="station"> block as "HH:MM 発 駅名"
function formatStation(inner: string): string {
  const time = inner.match(/(\d{1,2}:\d{2})/)?.[1] ?? '';
  let mark = '';
  if (/icnStaDep/.test(inner)) mark = '発';
  else if (/icnStaArr/.test(inner)) mark = '着';
  else if (/icnStaPass/.test(inner)) mark = '経由';
  const name = (inner.match(/<dt>(?:<a[^>]*>)?([^<]+)/)?.[1] ?? '').trim();
  return [time, mark, name].filter(Boolean).join(' ');
}

// build a compact, low-token summary of one route block
function formatRoute(block: string): string {
  const lines: string[] = [];

  const title = stripTags(block.match(/<h2 class="title">([\s\S]*?)<\/h2>/)?.[1] ?? 'ルート');
  const priority = (block.match(/<ul class="priority">([\s\S]*?)<\/ul>/)?.[1] ?? '')
    .match(/<span[^>]*>([^<]+)<\/span>/g)
    ?.map((s) => stripTags(s))
    .join('') ?? '';
  lines.push(priority ? `${title}（${priority}）` : title);

  // one-line summary: time / transfers / fare / distance
  const summary = block.match(/<ul class="summary">([\s\S]*?)<\/ul>/)?.[1] ?? '';
  const summaryParts = [
    stripTags(summary.match(/<li class="time">([\s\S]*?)<\/li>/)?.[1] ?? ''),
    stripTags(summary.match(/<li class="transfer">([\s\S]*?)<\/li>/)?.[1] ?? ''),
    stripTags(summary.match(/<li class="fare">([\s\S]*?)<\/li>/)?.[1] ?? ''),
    stripTags(summary.match(/<li class="distance">([\s\S]*?)<\/li>/)?.[1] ?? ''),
  ].filter(Boolean);
  if (summaryParts.length) lines.push(summaryParts.join(' / '));

  // legs: walk stations and the transport info between them, in order
  const detailIdx = block.indexOf('<div class="routeDetail">');
  if (detailIdx !== -1) {
    let detail = block.slice(detailIdx);
    detail = detail.replace(/<ul class="nav">[\s\S]*?<\/ul>/g, '');       // 時刻表/地図/出口
    detail = detail.replace(/<ul style="display:none">[\s\S]*?<\/ul>/g, ''); // 途中駅 (hidden)

    const tokenRe = /<div class="station">([\s\S]*?)<\/div>|<li class="transport">([\s\S]*?)<\/li>|<li class="platform">([\s\S]*?)<\/li>|<li class="stop">([\s\S]*?)<\/li>|<p class="fare">([\s\S]*?)<\/p>/g;
    let legParts: string[] = [];
    const flushLeg = () => {
      if (legParts.length) {
        lines.push('  ┃ ' + legParts.join(' '));
        legParts = [];
      }
    };
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(detail)) !== null) {
      if (m[1] !== undefined) {
        flushLeg();
        lines.push(formatStation(m[1]));
      } else {
        const text = stripTags(m[2] ?? m[3] ?? m[4] ?? m[5] ?? '');
        if (text) legParts.push(text);
      }
    }
    flushLeg();
  }

  return lines.join('\n');
}

/**
 * Extract a compact, low-token text summary of the route results from the
 * Yahoo! Transit result page HTML, dropping the surrounding markup/UI chrome.
 */
export function extractMainContent(html: string): string {
  // isolate the route results region
  const startKey = html.indexOf('id="srline"');
  let region = html;
  if (startKey !== -1) {
    const openIdx = html.lastIndexOf('<div', startKey);
    let endIdx = html.indexOf('id="mdRouteSearch"', startKey);
    if (endIdx === -1) endIdx = html.length;
    region = html.slice(openIdx === -1 ? startKey : openIdx, endIdx);
  }

  // split into individual route blocks and format each
  const blocks = region.split(/<div id="route\d+"/).slice(1);
  if (blocks.length > 0) {
    const formatted = blocks.map((b) => formatRoute(b)).join('\n\n').trim();
    if (formatted) return formatted;
  }

  // fallback: strip tags to plain text around the route section
  let content = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '\n');
  content = decodeEntities(content).replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();

  const textStart = content.indexOf('ルート1');
  const textEnd = content.indexOf('条件を変更して検索');
  if (textStart !== -1 && textEnd !== -1) {
    return content.substring(textStart, textEnd).trim();
  }
  return content;
}
