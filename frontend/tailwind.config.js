/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#E3F2FD",
          100: "#BBDEFB",
          500: "#1565C0",
          600: "#0D47A1",
        },
        estado: {
          anadido: "#FBC02D",
          aprobado: "#2E7D32",
          evaluado: "#FFC107",
          rechazado: "#D32F2F",
          baja: "#757575",
        },
      },
    },
  },
  plugins: [],
};
