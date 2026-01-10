import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        night: {
          900: "#050816",
          800: "#0b1020",
          700: "#15162a"
        },
        dream: {
          500: "#6b5bff",
          400: "#9b8cff",
          300: "#c7bfff"
        }
      },
      boxShadow: {
        glow: "0 0 40px rgba(155, 140, 255, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;


