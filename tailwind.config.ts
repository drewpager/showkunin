import { type Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      animation: {
        marquee: "marquee 25s linear infinite",
        marquee2: "marquee2 25s linear infinite",
      },
      keyframes: {
        marquee: {
          "0%": {
            transform: "translateX(0%)",
          },
          "100%": {
            transform: "translateX(-100%)",
          },
        },
        marquee2: {
          "0%": {
            transform: "translateX(100%)",
          },
          "100%": {
            transform: "translateX(0%)",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        "custom-white": "#fafafa",
        "custom-orange": "#b24432",
        "custom-black": "#080703",
        "custom-dark": "#5d594b",
      },
    },
  },
  plugins: [
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-call
    require("tailwindcss-radix")(),
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("tailwindcss-animate"),
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-call
    require("@vidstack/react/tailwind.cjs")({
      prefix: "media",
    }),
    customVariants,
  ],
} satisfies Config;

function customVariants({
  addVariant,
  matchVariant,
}: {
  addVariant: (name: string, styles: string | string[]) => void;
  matchVariant: (name: string, cb: (value: string) => string) => void;
}) {
  // Strict version of `.group` to help with nesting.
  matchVariant("parent-data", (value: string) => `.parent[data-${value}] > &`);

  addVariant("hocus", ["&:hover", "&:focus-visible"]);
  addVariant("group-hocus", [".group:hover &", ".group:focus-visible &"]);
}
