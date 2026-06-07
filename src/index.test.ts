/**
 * Unit tests for norikae-mcp
 * Run: npm test
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildYahooTransitUrl, extractMainContent, type SearchOptions } from './yahoo';

const __dirname = dirname(fileURLToPath(import.meta.url));

const defaultOptions: SearchOptions = {
  timeType: 'departure',
  ticket: 'ic',
  seatPreference: 'non_reserved',
  walkSpeed: 'slightly_slow',
  sortBy: 'time',
  useAirline: true,
  useShinkansen: true,
  useExpress: true,
  useHighwayBus: true,
  useLocalBus: true,
  useFerry: true,
};

describe('buildYahooTransitUrl', () => {
  it('should build basic URL with from and to', () => {
    const url = buildYahooTransitUrl('東京', '九段下', [], 2026, 1, 22, 10, 30, defaultOptions);
    expect(url).toContain('from=%E6%9D%B1%E4%BA%AC'); // 東京 encoded
    expect(url).toContain('to=%E4%B9%9D%E6%AE%B5%E4%B8%8B'); // 九段下 encoded
  });

  it('should set correct time parameters', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 35, defaultOptions);
    expect(url).toContain('y=2026');
    expect(url).toContain('m=01');
    expect(url).toContain('d=22');
    expect(url).toContain('hh=10');
    expect(url).toContain('m1=3'); // 35 / 10 = 3
    expect(url).toContain('m2=5'); // 35 % 10 = 5
  });

  it('should set departure type by default', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 30, defaultOptions);
    expect(url).toContain('type=1'); // departure
  });

  it('should set arrival type when specified', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 18, 0, {
      ...defaultOptions,
      timeType: 'arrival',
    });
    expect(url).toContain('type=4'); // arrival
  });

  it('should set first_train type', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 5, 0, {
      ...defaultOptions,
      timeType: 'first_train',
    });
    expect(url).toContain('type=3'); // 始発
  });

  it('should set last_train type', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 23, 0, {
      ...defaultOptions,
      timeType: 'last_train',
    });
    expect(url).toContain('type=2'); // 終電
  });

  it('should set unspecified type', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 12, 0, {
      ...defaultOptions,
      timeType: 'unspecified',
    });
    expect(url).toContain('type=5'); // 指定なし
  });

  it('should disable shinkansen when specified', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 30, {
      ...defaultOptions,
      useShinkansen: false,
    });
    expect(url).toContain('shin=0');
  });

  it('should set sort by fare', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 30, {
      ...defaultOptions,
      sortBy: 'fare',
    });
    expect(url).toContain('s=1'); // fare
  });

  it('should set sort by transfer', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 30, {
      ...defaultOptions,
      sortBy: 'transfer',
    });
    expect(url).toContain('s=2'); // transfer
  });

  it('should set walk speed to fast', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 30, {
      ...defaultOptions,
      walkSpeed: 'fast',
    });
    expect(url).toContain('ws=1'); // fast
  });

  it('should set cash ticket type', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 30, {
      ...defaultOptions,
      ticket: 'cash',
    });
    expect(url).toContain('ticket=normal'); // cash maps to 'normal'
  });

  it('should set reserved seat preference', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 30, {
      ...defaultOptions,
      seatPreference: 'reserved',
    });
    expect(url).toContain('expkind=2'); // 指定席優先
  });

  it('should set green car preference', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 30, {
      ...defaultOptions,
      seatPreference: 'green',
    });
    expect(url).toContain('expkind=3'); // グリーン車優先
  });

  it('should include single via station', () => {
    const url = buildYahooTransitUrl('東京', '新宿', ['表参道'], 2026, 1, 22, 10, 30, defaultOptions);
    expect(url).toContain('via=%E8%A1%A8%E5%8F%82%E9%81%93'); // 表参道 encoded
  });

  it('should include multiple via stations', () => {
    const url = buildYahooTransitUrl('東京', '新宿', ['表参道', '飯田橋', '広尾'], 2026, 1, 22, 10, 30, defaultOptions);
    expect(url).toContain('via=%E8%A1%A8%E5%8F%82%E9%81%93'); // 表参道
    expect(url).toContain('via=%E9%A3%AF%E7%94%B0%E6%A9%8B'); // 飯田橋
    expect(url).toContain('via=%E5%BA%83%E5%B0%BE'); // 広尾
  });
});

describe('extractMainContent', () => {
  const sample = readFileSync(join(__dirname, '__fixtures__', 'yahoo-sample.html'), 'utf-8');
  const result = extractMainContent(sample);

  it('should drop all HTML tags', () => {
    expect(result).not.toMatch(/<[^>]+>/);
  });

  it('should drop UI chrome and ads', () => {
    expect(result).not.toContain('ルート保存');
    expect(result).not.toContain('定期券');
    expect(result).not.toContain('ルート共有');
    expect(result).not.toContain('印刷する');
    expect(result).not.toContain('時刻表');
    expect(result).not.toContain('地図');
    expect(result).not.toContain('カレンダーに登録');
    expect(result).not.toContain('adArea');
    expect(result).not.toContain('次の3件');
  });

  it('should keep each route summary', () => {
    expect(result).toContain('ルート1（早楽安）');
    expect(result).toContain('ルート2（楽）');
    expect(result).toContain('ルート3（楽安）');
    expect(result).toContain('乗換：0回');
    expect(result).toContain('IC優先：480円');
    expect(result).toContain('30.3km');
  });

  it('should keep stations, lines and fares in order', () => {
    expect(result).toContain('08:53 発 岐阜');
    expect(result).toContain('09:14 着 名古屋');
    expect(result).toContain('ＪＲ東海道本線特別快速豊橋行');
    expect(result).toContain('[発] 1番線 → [着] 3番線');
    expect(result).toContain('自由席：760円'); // express leg on route 2
  });

  it('should be far smaller than the source HTML', () => {
    // tag-stripping should remove the bulk of the markup
    expect(result.length).toBeLessThan(sample.length / 3);
  });
});
