import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { PlannerLayout } from "./components/PlannerLayout";
import { initPlannerApp } from "./controllers/planner-controller";
import "./styles.css";

function PlannerBootstrap() {
  useEffect(() => {
    initPlannerApp();
  }, []);

  return <PlannerLayout />;
}

createRoot(document.getElementById("root") as HTMLElement).render(<PlannerBootstrap />);
