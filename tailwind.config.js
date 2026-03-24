/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./utils/**/*.{js,jsx,ts,tsx}",
   ],
  theme: {
    extend: {
      backgroundColor: {
        'primary': '#002366',
        'secondary': '#4a90e2',
      },
      colors: {
        primary: '#002366',
        secondary: '#4a90e2',
      },
      fontFamily: {
        'sans': ['Arial', 'sans-serif'],
      },
      
    },
  },
  plugins: [],
}