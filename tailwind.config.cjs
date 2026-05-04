/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#1b1411",
        ember: "#ff6a00",
        emberSoft: "#ff8a3d",
        emberDark: "#b64b12"
      },
      boxShadow: {
        glow: "0 20px 60px rgba(255, 106, 0, 0.15)"
      }
    }
  },
  plugins: []
};
