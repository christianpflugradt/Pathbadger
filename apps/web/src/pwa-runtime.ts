export interface PathbadgerServiceWorkerLike {
  register: (
    scriptUrl: string,
    options?: RegistrationOptions,
  ) => Promise<unknown>;
}

export interface PathbadgerNavigatorLike {
  standalone?: boolean;
  serviceWorker?: PathbadgerServiceWorkerLike;
}

export interface PathbadgerMatchMediaResultLike {
  matches: boolean;
}

export interface PathbadgerRuntimeWindowLike {
  console?: Pick<Console, "warn">;
  isSecureContext?: boolean;
  location?: Pick<Location, "hostname">;
  matchMedia?: (query: string) => PathbadgerMatchMediaResultLike;
  navigator?: PathbadgerNavigatorLike;
}

const SERVICE_WORKER_URL = "/service-worker.js";
const SERVICE_WORKER_SCOPE = "/";

export function isPathbadgerTrustedOrigin(options?: {
  hostname?: string | null;
  isSecureContext?: boolean;
}) {
  if (options?.isSecureContext === true) {
    return true;
  }

  const hostname = options?.hostname?.trim().toLowerCase() ?? "";

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

export function isPathbadgerStandaloneDisplayMode(options?: {
  matchMedia?: (query: string) => PathbadgerMatchMediaResultLike;
  navigator?: Pick<PathbadgerNavigatorLike, "standalone">;
}) {
  return (
    options?.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    options?.navigator?.standalone === true
  );
}

export function supportsPathbadgerServiceWorkerRuntime(options?: {
  hostname?: string | null;
  isSecureContext?: boolean;
  navigator?: Pick<PathbadgerNavigatorLike, "serviceWorker">;
}) {
  return (
    Boolean(options?.navigator?.serviceWorker) &&
    isPathbadgerTrustedOrigin({
      hostname: options?.hostname ?? null,
      isSecureContext: options?.isSecureContext ?? false,
    })
  );
}

export async function registerPathbadgerServiceWorker(options?: {
  runtimeWindow?: PathbadgerRuntimeWindowLike | null;
}) {
  const runtimeWindow =
    options?.runtimeWindow ??
    (typeof window === "undefined"
      ? null
      : {
          console,
          isSecureContext: window.isSecureContext,
          location: window.location,
          matchMedia: window.matchMedia.bind(window),
          navigator,
        });

  if (!runtimeWindow) {
    return null;
  }

  const navigatorLike = runtimeWindow.navigator;
  const serviceWorkerNavigator = navigatorLike?.serviceWorker
    ? {
        serviceWorker: navigatorLike.serviceWorker,
      }
    : undefined;

  if (
    !supportsPathbadgerServiceWorkerRuntime({
      hostname: runtimeWindow.location?.hostname ?? null,
      isSecureContext: runtimeWindow.isSecureContext ?? false,
      ...(serviceWorkerNavigator ? { navigator: serviceWorkerNavigator } : {}),
    })
  ) {
    return null;
  }

  try {
    return await navigatorLike?.serviceWorker?.register(SERVICE_WORKER_URL, {
      scope: SERVICE_WORKER_SCOPE,
    });
  } catch (error) {
    runtimeWindow.console?.warn?.(
      "Pathbadger could not register the service worker.",
      error,
    );
    return null;
  }
}
