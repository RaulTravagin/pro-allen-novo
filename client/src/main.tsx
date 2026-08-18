import { trpc } from "@/lib/trpc";
import { createRoot } from "react-dom/client";
import LocalContingency from "./pages/LocalContingency";
import "./index.css";

if (import.meta.env.VITE_STATIC_LOCAL_ONLY === "true") {
  createRoot(document.getElementById("root")!).render(<LocalContingency />);
} else {
  void import("./bootstrapOnline");
}
