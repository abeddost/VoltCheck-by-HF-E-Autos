import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HF VoltCheck",
    short_name: "VoltCheck",
    description: "Ankaufsprüfung für E-Autos von HF E-Autos",
    start_url: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#0B1F33",
    lang: "de",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
