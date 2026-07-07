import { parseUserAgent } from '../src/lib/parseUserAgent';

describe('parseUserAgent', () => {
  it('returns "Unknown device" for undefined', () => {
    expect(parseUserAgent(undefined)).toBe('Unknown device');
  });

  it('returns "Unknown device" for null', () => {
    expect(parseUserAgent(null)).toBe('Unknown device');
  });

  it('detects Chrome on Windows', () => {
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36')).toBe('Chrome on Windows');
  });

  it('detects Firefox on Mac', () => {
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:120.0) Gecko/20100101 Firefox/120.0')).toBe('Firefox on Mac');
  });

  it('detects Safari on Mac', () => {
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')).toBe('Safari on Mac');
  });

  it('detects Chrome on Android', () => {
    expect(parseUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36')).toBe('Chrome on Android');
  });

  it('detects Edge on Windows', () => {
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0')).toBe('Edge on Windows');
  });
});
