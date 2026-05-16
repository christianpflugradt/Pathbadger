const CACHE_NAME = "pathbadger-shell-v1";
const SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/pathbadger-icon.svg",
];
const NETWORK_ONLY_PREFIXES = [
  "/@fs/",
  "/@vite/",
  "/api",
  "/src/",
  "/styles",
  "/tiles",
];
const STATIC_CACHE_PREFIXES = ["/assets/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter((cacheName) => cacheName !== CACHE_NAME)
              .map((cacheName) => caches.delete(cacheName)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (
    NETWORK_ONLY_PREFIXES.some((prefix) =>
      requestUrl.pathname.startsWith(prefix),
    )
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (
    requestUrl.pathname === "/manifest.webmanifest" ||
    requestUrl.pathname === "/favicon.svg" ||
    requestUrl.pathname.startsWith("/icons/") ||
    STATIC_CACHE_PREFIXES.some((prefix) =>
      requestUrl.pathname.startsWith(prefix),
    )
  ) {
    event.respondWith(handleStaticRequest(request));
  }
});

async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put("/", response.clone());
    }

    return response;
  } catch {
    return (
      (await caches.match(request)) ??
      (await caches.match("/")) ??
      Response.error()
    );
  }
}

async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  const networkResponsePromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => null);

  return cachedResponse ?? (await networkResponsePromise) ?? Response.error();
}
