import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0b1020",
          900: "#0f1530",
          850: "#121a3a",
          800: "#152042",
          700: "#1b2b56"
        },
        teal: {
          600: "#14b8a6",
          500: "#2dd4bf",
          400: "#5eead4",
          300: "#99f6e4"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glass: "0 20px 60px rgba(6, 10, 22, 0.45)",
        glow: "0 0 30px rgba(45, 212, 191, 0.35)"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        float: {
          "0%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
          "100%": { transform: "translateY(0px)" }
        }
      },
      animation: {
        "fade-up": "fade-up 0.8s ease-out both",
        "float-slow": "float 12s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
