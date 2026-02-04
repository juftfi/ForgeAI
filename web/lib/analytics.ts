/**
 * Analytics Event Tracking
 *
 * Lightweight event tracking system. By default logs to console.
 * Enable PostHog or other providers via environment variables.
 */

type EventName =
  | 'page_view'
  | 'wallet_connect'
  | 'wallet_disconnect'
  | 'mint_started'
  | 'mint_success'
  | 'mint_error'
  | 'mint_attempt'
  | 'preview_agent'
  | 'reserve_agent'
  | 'fusion_commit'
  | 'fusion_reveal'
  | 'fusion_cancel'
  | 'agent_view'
  | 'gallery_filter'
  | 'tree_view'
  | 'doc_view'
  | 'download_media';

interface EventProperties {
  [key: string]: string | number | boolean | undefined;
}

const isDev = process.env.NODE_ENV === 'development';
const analyticsEnabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';

/**
 * Track an analytics event
 */
export function trackEvent(name: EventName, properties?: EventProperties): void {
  const timestamp = new Date().toISOString();
  const eventData = {
    event: name,
    properties: properties || {},
    timestamp,
    url: typeof window !== 'undefined' ? window.location.href : '',
  };

  // Always log in development
  if (isDev) {
    console.log('[Analytics]', name, properties || {});
  }

  // Send to analytics provider if enabled
  if (analyticsEnabled && typeof window !== 'undefined') {
    // PostHog integration (if available)
    if ((window as any).posthog) {
      (window as any).posthog.capture(name, properties);
    }

    // Google Analytics integration (if available)
    if ((window as any).gtag) {
      (window as any).gtag('event', name, properties);
    }
  }
}

/**
 * Track page view
 */
export function trackPageView(path: string, title?: string): void {
  trackEvent('page_view', { path, title });
}

/**
 * Track wallet connection
 */
export function trackWalletConnect(address: string, chainId: number): void {
  trackEvent('wallet_connect', {
    address: address.slice(0, 10) + '...',
    chainId,
  });
}

/**
 * Track mint action
 */
export function trackMint(
  status: 'started' | 'success' | 'error',
  details?: { tokenId?: number; house?: string; error?: string }
): void {
  const eventMap = {
    started: 'mint_started',
    success: 'mint_success',
    error: 'mint_error',
  } as const;
  trackEvent(eventMap[status], details);
}

/**
 * Track fusion action
 */
export function trackFusion(
  action: 'commit' | 'reveal' | 'cancel',
  details?: { parentA?: number; parentB?: number; mode?: string }
): void {
  const eventMap = {
    commit: 'fusion_commit',
    reveal: 'fusion_reveal',
    cancel: 'fusion_cancel',
  } as const;
  trackEvent(eventMap[action], details);
}

/**
 * Track agent view
 */
export function trackAgentView(tokenId: number, house?: string): void {
  trackEvent('agent_view', { tokenId, house });
}

/**
 * Track document view
 */
export function trackDocView(slug: string, section?: string): void {
  trackEvent('doc_view', { slug, section });
}

/**
 * Track media download
 */
export function trackMediaDownload(asset: string): void {
  trackEvent('download_media', { asset });
}

/**
 * Track mint attempt
 */
export function trackMintAttempt(tokenId: number, house: string): void {
  trackEvent('mint_attempt', { tokenId, house });
}
