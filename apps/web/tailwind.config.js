/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#F5F6F8",
          raised: "#FFFFFF",
          higher: "#ECEEF2",
        },
        ink: {
          DEFAULT: "#121318",
          secondary: "#555C68",
          tertiary: "#7B828E",
        },
        line: {
          DEFAULT: "#E3E6EB",
          strong: "#CCD1D9",
        },
        accent: {
          DEFAULT: "#635BFF",
          strong: "#4A43DE",
        },
        risk: {
          negative: "#E5485D",
          "negative-strong": "#D6384E",
          warning: "#D98B19",
          positive: "#168A62",
          neutral: "#7B828E",
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"SF Pro Display"', "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ['"IBM Plex Serif"', "ui-serif", "Georgia", "serif"],
        // Existing analytical components use `font-mono` heavily. Pointing it
        // at the product font keeps tabular spacing without a terminal look.
        mono: ['"Inter"', '"SF Pro Text"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 8px 30px rgba(17, 24, 39, 0.06)",
      },
    },
  },
  plugins: [],
};
