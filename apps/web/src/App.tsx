import { activityOptions, surfacePreferenceOptions } from "@pathbadger/shared";

import { webRuntimeConfig } from "./config";
import "./styles.css";

export function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Pathbadger</p>
        <h1>Agent-ready scaffold for a self-hosted trail routing app.</h1>
        <p className="lead">
          The product roadmap is initialized, the monorepo is wired, and the
          frontend now carries an explicit self-hosted tile-style contract for
          future MapLibre integration.
        </p>
      </section>

      <section className="card-grid">
        <article className="card">
          <h2>Initial activities</h2>
          <ul>
            {activityOptions.map((activity) => (
              <li key={activity}>{activity}</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Surface preferences</h2>
          <ul>
            {surfacePreferenceOptions.map((preference) => (
              <li key={preference}>{preference}</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Current status</h2>
          <ul>
            <li>
              Routing and map behavior are intentionally not implemented yet.
            </li>
            <li>
              Self-hosted GraphHopper and tiles are reserved in Docker Compose.
            </li>
            <li>
              Future map style source:{" "}
              <code>{webRuntimeConfig.tileStyleUrl}</code>
            </li>
            <li>Target region: {webRuntimeConfig.regionName}</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
