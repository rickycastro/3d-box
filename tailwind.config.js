/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "#171717",
        fog: "#f8f6f1",
        sand: "#e9e1d4",
        ocean: "#28536b",
        clay: "#cbb79b"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(24, 24, 24, 0.12)"
      }
    }
  },
  plugins: []
};
