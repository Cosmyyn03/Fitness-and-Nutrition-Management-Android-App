/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors:{
        primary: '#030014',
        secondary: '#151312',
        title:'#bd0c0c',

        light: {
          100: '#D6C6FF',
          200: '#A8B5DB',
          300: '#9CA4AB',

        },

        Selected_date:'#bd0c0c',


        label_inactive:'#c5c5e8',

        dark: {
          100:'#221f3d',
          200: '#0f0d23',
        },
        accent: '#AB8BFF'
      }
    },
  },
  plugins: [],
}