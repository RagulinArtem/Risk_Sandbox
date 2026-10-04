/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0F0F11",
          raised: "#17171A",
          higher: "#1D1D21",
        },
        ink: {
          DEFAULT: "#EDEBE6",
          secondary: "#A8A6A0",
          tertiary: "#8C8A85", // lighter for projector legibility
        },
        line: {
          DEFAULT: "#2B2B30",
          strong: "#3A3A40",
        },
        accent: {
          DEFAULT: "#5C8AC7",
          strong: "#7BA3D6",
        },
        risk: {
          negative: "#C4453F",
          "negative-strong": "#E8635C",
          warning: "#C48A32",
          positive: "#4A9B6E",
          neutral: "#706E6A",
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ['"IBM Plex Serif"', "ui-serif", "Georgia", "serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
