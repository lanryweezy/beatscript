/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'beatscript-black': '#0a0a0a',
        'beatscript-gray': '#1a1a1a',
        'beatscript-purple': '#8b5cf6',
      }
    },
  },
  plugins: [],
}
