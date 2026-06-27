/**
 * Rewrites a campaign's HTML so opens and clicks become visible events.
 *
 * - Every http(s) link gets routed through /track/click/:token first,
 *   so we log the click before redirecting to the real destination.
 * - A 1x1 invisible image is added pointing at /track/open/:token - mail
 *   clients that load remote images (most do, by default) will fire this
 *   request, which is how "opens" get counted.
 *
 * This is regex-based, not a full HTML parser - fine for straightforward
 * campaign markup, but a malformed or deeply nested document could slip
 * past it. A production system would use a real HTML parser (e.g. cheerio)
 * to do this safely on arbitrary markup.
 */
export function injectTracking(html: string, token: string, baseUrl: string): string {
  const withTrackedLinks = html.replace(/href=(["'])(.*?)\1/gi, (match, quote, url) => {
    if (!/^https?:\/\//i.test(url)) return match; // leave mailto:, #anchors, etc. alone

    const trackedUrl = `${baseUrl}/track/click/${token}?u=${encodeURIComponent(url)}`;
    return `href=${quote}${trackedUrl}${quote}`;
  });

  const pixel = `<img src="${baseUrl}/track/open/${token}" width="1" height="1" alt="" style="display:none" />`;

  if (/<\/body>/i.test(withTrackedLinks)) {
    return withTrackedLinks.replace(/<\/body>/i, `${pixel}</body>`);
  }
  return withTrackedLinks + pixel;
}

/** 1x1 transparent GIF served for every open-pixel request. */
export const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
  'base64'
);
