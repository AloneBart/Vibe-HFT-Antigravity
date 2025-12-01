/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                'primary': '#00ebc7',
                'accent-bid-buy': '#00ebc7',
                'accent-ask-sell': '#ff2a51',
                'background-primary': '#0b0e11',
                'background-secondary': '#151a21',
                'borders': '#2a3441',
                'text-primary': '#e0e0e0',
                'text-secondary': '#8a94a6',
            },
            fontFamily: {
                'display': ['Inter', 'sans-serif'],
                'data': ['Roboto Mono', 'monospace'],
            },
            borderRadius: {
                'DEFAULT': '0.25rem',
                'lg': '0.5rem',
                'xl': '0.75rem',
                'full': '9999px'
            }
        }
    },
    plugins: [],
}
