import type { MetadataRoute } from "next";

// PWA / install manifest. Colors match the desk theme.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SolveLog",
    short_name: "SolveLog",
    description: "Capture every problem you solve and remember it - your practice, filed by hand.",
    start_url: "/",
    display: "standalone",
    background_color: "#1c1812",
    theme_color: "#1c1812",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
