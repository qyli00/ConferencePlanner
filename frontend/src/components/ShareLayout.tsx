import React from "react";

export function ShareLayout() {
  return (
    <>
      <div className="bg bg-a"></div>
      <div className="bg bg-b"></div>
      <header className="hero">
        <div className="hero-top">
          <p className="eyebrow">Shared Schedule</p>
          <a id="openPlannerBtn" className="btn primary hero-back-link" href="/planner">
            Import Into Planner
          </a>
        </div>
        <h1 id="shareTitle">Loading shared schedule...</h1>
        <p id="shareSubtitle" className="subtitle">
          Preview this shared schedule, then import it into your planner.
        </p>
      </header>

      <main className="layout">
        <section className="panel share-view-panel">
          <div className="panel-head">
            <h2>Events</h2>
            <p id="shareMetaText"></p>
          </div>
          <div id="shareStatusMessage" className="status share-status">
            Loading shared link...
          </div>
          <div id="shareImportHint" className="status share-import-hint"></div>
          <div id="shareEventContainer" className="share-event-container"></div>
        </section>
      </main>
    </>
  );
}
