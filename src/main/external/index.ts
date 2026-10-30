/**
 * Process-wide wiring for the external gallery: the active profile and the
 * single fetcher built from it. Electron-dependent, so kept apart from the
 * unit-testable modules it composes.
 */
import { app } from 'electron';
import { getSiteProfile } from './profileLoader';
import { ExternalFetcher } from './fetcher';

let fetcher: ExternalFetcher | null = null;

/**
 * Development/test switch that lets a local http fixture server stand in for
 * the site (see `HostPolicyOptions.allowInsecure`). Ignored in packaged builds.
 */
export const ALLOW_INSECURE_ENV = 'EXTERNAL_GALLERY_ALLOW_INSECURE';
/**
 * Comma-separated extra hosts (host or host:port) added to the allow list.
 * Only honoured together with `ALLOW_INSECURE_ENV`, so it is unreachable in a
 * packaged build; e2e tests use it to point the app at a throwaway server.
 */
export const EXTRA_HOSTS_ENV = 'EXTERNAL_GALLERY_EXTRA_HOSTS';

export function getExternalFetcher(): ExternalFetcher {
  if (!fetcher) {
    const { profile } = getSiteProfile();
    const allowInsecure = process.env[ALLOW_INSECURE_ENV] === '1' && !app.isPackaged;
    const allowedHosts = [...profile.allowedHosts];
    if (allowInsecure) {
      const extra = (process.env[EXTRA_HOSTS_ENV] ?? '')
        .split(',')
        .map((h) => h.trim())
        .filter((h) => h.length > 0);
      allowedHosts.push(...extra);
      console.warn(
        `External gallery: insecure transport allowed by environment (development only)` +
          (extra.length ? `; extra hosts: ${extra.join(', ')}` : '')
      );
    }
    fetcher = new ExternalFetcher({
      allowedHosts,
      rateLimit: profile.rateLimit,
      allowInsecure,
    });
  }
  return fetcher;
}
