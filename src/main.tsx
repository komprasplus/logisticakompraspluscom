import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global safety net: avoid hard-crashes on unhandled promise rejections
// (e.g. a failing Supabase query during initial dashboard boot)
window.addEventListener("unhandledrejection", (event) => {
  // Prevent the default noisy error from bubbling and potentially breaking UX
  event.preventDefault();
  console.error("Unhandled promise rejection:", event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
