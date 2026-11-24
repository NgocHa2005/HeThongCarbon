
import React from "react";
import { createRoot } from "react-dom/client";
import AdminApp from "./admin/App.jsx";
import UserApp from "./user/App.jsx";
import "./style.css";
import "./index.css";

const isAdminRoute = window.location.pathname.startsWith("/admin");
const App = isAdminRoute ? AdminApp : UserApp;
document.title = isAdminRoute ? "CarbonScope Admin" : "CarbonScope";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
