/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"],
  theme: {
    extend: {
      colors: { 
        brand: { 
          50: '#f0f9ff', 
          100: '#e0f2fe', 
          500: '#0ea5e9', 
          600: '#0284c7', 
          900: '#0f172a' 
        } 
      }
    },
  },
  plugins: [],
}