import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#171914",
        copilot: {
          green: "#0f8f68",
          amber: "#d47b28",
          violet: "#6746b6"
        }
      }
    }
  }
};

export default config;
