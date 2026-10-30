/**
 * Mapping between a remote image URL and the app-internal URL the renderer
 * puts in `<img src>`. The main process serves the scheme via `protocol.handle`
 * after fetching, allow-listing and sniffing the bytes, so the renderer never
 * contacts the site and the CSP never needs a remote `img-src`.
 */

export const GALLERY_IMAGE_SCHEME = 'gallery-image';
/** Fixed host part; the remote URL travels in the query so nothing is lowercased. */
export const GALLERY_IMAGE_ORIGIN = `${GALLERY_IMAGE_SCHEME}://fetch`;
const PARAM = 'u';

export function toGalleryImageUrl(remoteUrl: string): string {
  return `${GALLERY_IMAGE_ORIGIN}/?${PARAM}=${encodeURIComponent(remoteUrl)}`;
}

/** Inverse of `toGalleryImageUrl`; null for anything that is not one of ours. */
export function fromGalleryImageUrl(requestUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.protocol !== `${GALLERY_IMAGE_SCHEME}:`) {
    return null;
  }
  const remote = url.searchParams.get(PARAM);
  return remote && remote.length > 0 ? remote : null;
}
