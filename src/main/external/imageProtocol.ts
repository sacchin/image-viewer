/**
 * Serves `gallery-image://fetch/?u=<remote url>` to the renderer. The bytes
 * come from `ExternalFetcher`, so every image the UI shows has passed the host
 * allow list, the size cap and the magic-byte sniff, and the renderer's CSP
 * never has to name a remote host.
 */
import { protocol } from 'electron';
import { GALLERY_IMAGE_SCHEME, fromGalleryImageUrl } from '../../shared/external/imageUrl';
import { FetchError, type ExternalFetcher } from './fetcher';

/** Must run before `app.whenReady()` resolves. */
export function registerGalleryImageScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: GALLERY_IMAGE_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: false,
        corsEnabled: false,
        stream: true,
      },
    },
  ]);
}

const statusFor = (error: unknown): number => {
  if (!(error instanceof FetchError)) {
    return 502;
  }
  switch (error.kind) {
    case 'policy':
      return 403;
    case 'validation':
      return 415;
    case 'http':
    case 'redirect':
    case 'network':
    default:
      return 502;
  }
};

/** Resolve the fetcher lazily so the profile is only loaded once the app is ready. */
export function handleGalleryImageProtocol(getFetcher: () => ExternalFetcher): void {
  protocol.handle(GALLERY_IMAGE_SCHEME, async (request) => {
    const remote = fromGalleryImageUrl(request.url);
    if (!remote) {
      return new Response('Bad request', { status: 400 });
    }
    try {
      const { bytes, mimeType } = await getFetcher().fetchImage(remote);
      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(bytes.byteLength),
          // Belt and braces: the bytes never came through Chromium's net stack,
          // and this keeps the renderer from caching them either
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Image fetch failed';
      console.warn(`gallery-image: ${message} (${remote})`);
      return new Response(message, { status: statusFor(error), headers: { 'Cache-Control': 'no-store' } });
    }
  });
}
