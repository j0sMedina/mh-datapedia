/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Oswald', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: '#2f9e8f',
          hover:   '#45bcab',
          strong:  '#237a6e',
        },
      },
    },
  },
  plugins: [],
};
