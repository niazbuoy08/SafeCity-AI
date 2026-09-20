/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0a1128",
          900: "#0f1b3d",
          800: "#152a52",
          700: "#1e3a6b",
          600: "#2a4d8a",
        },
        brand: {
          critical: "#dc2626",
          high: "#ea580c",
          medium: "#d97706",
          low: "#16a34a",
          verified: "#16a34a",
          amber: "#f59e0b",
        },
      },
    },
  },
  plugins: [],
};
