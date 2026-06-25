import type { MetadataRoute } from "next";

// PWA / install manifest. Colors match the desk theme.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CP Journal",
    short_name: "CP Journal",
    description: "A competitive-programming journal & public portfolio - every problem filed by hand.",
    start_url: "/",
    display: "standalone",
    background_color: "#1c1812",
    theme_color: "#1c1812",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
