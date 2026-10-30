/**
 * Decides whether the main process may fetch a URL on behalf of the external
 * gallery browser. Pure and shared so the renderer can pre-check URLs and the
 * main process can enforce the same rule.
 *
 * The rule is deliberately narrow: https only, no credentials in the URL, no
 * IP literals, and the host must be listed exactly in the profile's
 * `allowedHosts`. Redirect targets go through the same check, hop by hop.
 */

export interface HostPolicyOptions {
  /**
   * Development/test escape hatch: also accept plain http and loopback
   * literals so a local fixture server can stand in for the site. Never on in
   * a packaged build.
   */
  allowInsecure?: boolean;
}

export type HostCheck = { ok: true; url: URL } | { ok: false; reason: string };

const IPV4_LITERAL = /^\d{1,3}(\.\d{1,3}){3}$/;

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

export function isIpLiteral(hostname: string): boolean {
  const h = normalizeHost(hostname);
  return IPV4_LITERAL.test(h) || h.startsWith('[') || h.includes(':');
}

export function isLoopback(hostname: string): boolean {
  const h = normalizeHost(hostname).replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '::1' || h.startsWith('127.');
}

export function checkUrlAgainstPolicy(
  input: string,
  allowedHosts: string[],
  options: HostPolicyOptions = {}
): HostCheck {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }

  if (url.protocol !== 'https:' && !(options.allowInsecure && url.protocol === 'http:')) {
    return { ok: false, reason: `Protocol not allowed: ${url.protocol}` };
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'Credentials in URL are not allowed' };
  }

  const hostname = normalizeHost(url.hostname);
  if (isIpLiteral(hostname) && !(options.allowInsecure && isLoopback(hostname))) {
    return { ok: false, reason: 'IP literal hosts are not allowed' };
  }

  // Entries may be bare host names or host:port; compare against both forms
  const hostWithPort = normalizeHost(url.host);
  const allowed = allowedHosts.some((entry) => {
    const e = normalizeHost(entry);
    return e === hostname || e === hostWithPort;
  });
  if (!allowed) {
    return { ok: false, reason: `Host not in allow list: ${hostname}` };
  }

  return { ok: true, url };
}
