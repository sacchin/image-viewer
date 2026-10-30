/**
 * The site profile used by the renderer.
 *
 * `@site-profile` is resolved at build time: webpack.config.js points it at
 * `src/shared/sites/private` when that directory exists and at
 * `src/shared/sites/example` otherwise, and tsconfig.json lists both so type
 * checking follows the same fallback. The main process does the equivalent at
 * runtime in `src/main/external/profileLoader.ts`.
 */
import { siteProfile } from '@site-profile';
import type { SiteProfile } from '@shared/sites/types';

export const activeSiteProfile: SiteProfile = siteProfile;
