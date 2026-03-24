/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./{App,types,index}.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
    "./contexts/**/*.{ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#121212',
        card: '#1e1e1e',
        accent: {
          green: '#a3e635',
          blurple: '#6366f1',
        },
        text: {
          primary: '#ededed',
          secondary: '#a1a1aa',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
