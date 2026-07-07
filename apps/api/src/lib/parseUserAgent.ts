export function parseUserAgent(ua: string | undefined | null): string {
  if (!ua) return 'Unknown device';
  if (/mobile|android/i.test(ua)) {
    if (/iphone|ipad/i.test(ua)) return 'Safari on iPhone';
    if (/android/i.test(ua)) return 'Chrome on Android';
    return 'Mobile browser';
  }
  if (/chrome/i.test(ua) && !/edg|opr/i.test(ua)) return 'Chrome on ' + getOS(ua);
  if (/firefox/i.test(ua)) return 'Firefox on ' + getOS(ua);
  if (/edg/i.test(ua)) return 'Edge on ' + getOS(ua);
  if (/safari/i.test(ua)) return 'Safari on Mac';
  return 'Browser on ' + getOS(ua);
}

function getOS(ua: string): string {
  if (/windows/i.test(ua)) return 'Windows';
  if (/mac os/i.test(ua)) return 'Mac';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown OS';
}
