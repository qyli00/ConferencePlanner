import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ShareLayout } from "./components/ShareLayout";
import { initShareView } from "./controllers/share-view-controller";
import "./styles.css";

function ShareBootstrap() {
  useEffect(() => {
    initShareView();
  }, []);

  return <ShareLayout />;
}

createRoot(document.getElementById("root") as HTMLElement).render(<ShareBootstrap />);
