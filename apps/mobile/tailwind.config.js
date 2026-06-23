/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{tsx,ts}',
    './src/**/*.{tsx,ts}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#2f9e8f',
          hover: '#45bcab',
          strong: '#237a6e',
        },
      },
    },
  },
  plugins: [],
};
