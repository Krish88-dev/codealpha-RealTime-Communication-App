/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        surface: '#1e293b',
        primary: '#3b82f6',
        primaryHover: '#2563eb',
        danger: '#ef4444',
        dangerHover: '#dc2626'
      }
    },
  },
  plugins: [],
}
