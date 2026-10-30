/**
 * Resolves which site profile the main process runs with.
 *
 * The private profile is optional and git-ignored, so it is loaded with a
 * runtime `require` instead of a static import: a static import would fail to
 * compile on any checkout that does not have it. When it is missing (or does
 * not satisfy the contract) the committed sample profile is used, and the UI
 * is told so via `isSample`.
 */
import { exampleProfile } from '../../shared/sites/example';
import { isSiteProfile, type SiteProfile } from '../../shared/sites/types';

export interface LoadedSiteProfile {
  profile: SiteProfile;
  /** True when no valid private profile was found and the sample is in use. */
  isSample: boolean;
}

/** Relative to this file's compiled location (dist/main/external). */
export const PRIVATE_PROFILE_MODULE = '../../shared/sites/private';

type ModuleLoader = (id: string) => unknown;

function isModuleNotFound(error: unknown, id: string): boolean {
  const err = error as { code?: unknown; message?: unknown } | null;
  return (
    !!err &&
    err.code === 'MODULE_NOT_FOUND' &&
    typeof err.message === 'string' &&
    err.message.includes(id)
  );
}

export function loadSiteProfile(load: ModuleLoader = require): LoadedSiteProfile {
  try {
    const mod = load(PRIVATE_PROFILE_MODULE) as { siteProfile?: unknown; default?: unknown } | null;
    const candidate = mod?.siteProfile ?? mod?.default;
    if (isSiteProfile(candidate)) {
      return { profile: candidate, isSample: false };
    }
    console.warn('Private site profile does not export a valid siteProfile; using the sample profile');
  } catch (error) {
    if (!isModuleNotFound(error, PRIVATE_PROFILE_MODULE)) {
      // The module exists but threw while loading: surface it, then fall back
      console.warn('Failed to load private site profile; using the sample profile:', error);
    }
  }
  return { profile: exampleProfile, isSample: true };
}

let cached: LoadedSiteProfile | null = null;

/** Profile for this process, resolved once. */
export function getSiteProfile(): LoadedSiteProfile {
  if (!cached) {
    cached = loadSiteProfile();
  }
  return cached;
}
