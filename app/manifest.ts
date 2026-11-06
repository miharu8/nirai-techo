import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ニライの手帖",
    short_name: "ニライ",
    start_url: "/",
    display: "standalone",
    background_color: "#d6eef0",
    theme_color: "#264e70",
    icons: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
  };
}
