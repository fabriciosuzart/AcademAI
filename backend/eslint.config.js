import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        ignores: ["node_modules/**", "uploads/**", "prisma/**", "tests/**"],
    },
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                console: "readonly",
                process: "readonly",
                Buffer: "readonly",
                __dirname: "readonly",
                fetch: "readonly",
                performance: "readonly",
                AbortSignal: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
            }
        },
        rules: {
            "no-unused-vars": ["warn"],
            "no-undef": "error"
        }
    }
];
