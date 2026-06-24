/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#121212',
        surface: '#181818',
        surface2: '#282828',
        accent: '#9b8cff',
        accentHover: '#b4a8ff',
      },
    },
  },
  plugins: [],
};
