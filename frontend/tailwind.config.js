/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Nunito", "Arial", "Helvetica Neue", "sans-serif"],
      },
      colors: {
        // Klyp / KRIA brand palette
        klyp: {
          navy:   "#051937",  // primary — headers, sidebar, logo
          light:  "#1A3A6B",  // secondary navy
          accent: "#2E6DB4",  // CTAs, links, interactive
          pale:   "#E8EDF5",  // secondary backgrounds
          gray:   "#6B7280",  // body text, subtitles
        },
        brand: {
          50:  "#E8EDF5",  // pale blue
          100: "#c5d3e8",
          500: "#2E6DB4",  // accent
          600: "#1A3A6B",  // navy light
          700: "#051937",  // navy
          900: "#051937",
        },
        estado: {
          anadido:  "#FBC02D",
          aprobado: "#2E7D32",
          evaluado: "#FFC107",
          rechazado:"#D32F2F",
          baja:     "#757575",
        },
      },
    },
  },
  plugins: [],
};
