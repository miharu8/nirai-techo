import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ニライの手帖",
    short_name: "ニライ手帖",
    start_url: "/",
    display: "standalone",
    background_color: "#eef5f6",
    theme_color: "#2f6584",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
