import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";

import { missing } from "./config.js";

const root = createRoot(document.getElementById("root"));

if (missing.length) {
  // Evita una pantalla en blanco si falta configuración
  root.render(
    <div className="container py-5">
      <div className="alert alert-danger">
        <h4>Configuración incompleta</h4>
        <p>Faltan variables de entorno: {missing.join(", ")}</p>
      </div>
    </div>,
  );
} else {
  import("./App.jsx").then(({ default: App }) =>
    root.render(<StrictMode><App /></StrictMode>));
}
