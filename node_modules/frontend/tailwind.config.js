/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                lotto: {
                    primary: '#6d28d9',
                    secondary: '#7c3aed',
                    accent: '#c084fc',
                }
            }
        },
    },
    plugins: [],
}
