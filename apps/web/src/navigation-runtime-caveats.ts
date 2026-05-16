export interface NavigationRuntimeCaveat {
  id: string;
  title: string;
  body: string;
}

export function getNavigationRuntimeCaveatSummary() {
  return "Supported browser navigation is useful with the screen on and the app active, but iPhone, Safari, and PWA runtime limits still apply.";
}

export function getNavigationRuntimeCaveats(): NavigationRuntimeCaveat[] {
  return [
    {
      id: "permission",
      title: "Location permission is required",
      body: "Navigation can only follow the live route after browser geolocation permission is granted. If permission is denied or revoked, Pathbadger pauses live updates instead of pretending it still has a current fix.",
    },
    {
      id: "https",
      title: "Production geolocation needs HTTPS",
      body: "The supported local workflow can use http://localhost, but deployed browser geolocation generally requires HTTPS before iPhone-class browsers will provide reliable live position access.",
    },
    {
      id: "background",
      title: "Background behavior is limited",
      body: "iPhone browsers and installed PWAs may pause, throttle, or delay geolocation after the app loses focus or the screen locks, so the MVP assumes the screen stays on and the app remains active.",
    },
    {
      id: "wake-lock",
      title: "Wake Lock support varies",
      body: "Browsers do not guarantee Wake Lock support, and Pathbadger does not assume it can keep the device awake for you during navigation.",
    },
    {
      id: "pwa",
      title: "PWA does not equal native",
      body: "An installed PWA still inherits browser limits around permissions, background execution, and device integration, so supported behavior may differ from a native turn-by-turn app.",
    },
    {
      id: "install",
      title: "Install from Safari on HTTPS",
      body: "For the supported iPhone install path, serve Pathbadger over HTTPS and add it to the Home Screen from Safari so the standalone web-app shell and browser geolocation permissions behave consistently.",
    },
  ];
}
