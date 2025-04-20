import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import vike from "vike/plugin";

export default defineConfig({
  base: "/hsiaoooo/",
  plugins: [vike({}), react({}), tailwindcss()],
  build: {
    target: "es2022",
  },
});
