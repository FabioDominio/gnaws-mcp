import js from "@eslint/js";
import {defineConfig} from "eslint/config";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";

export default defineConfig([
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    stylistic.configs.all,
    {
        "languageOptions": {
            "parserOptions": {
                "project": true,
                "tsconfigRootDir": import.meta.dirname
            }
        }
    },
    {
        "ignores": [
            ".built/",
            ".data/",
            "dist/"
        ]
    },
    {
        "rules": {
            "@typescript-eslint/no-unused-vars": [
                "error",
                {"argsIgnorePattern": "^_",
                    "varsIgnorePattern": "^_"}
            ],
            "@typescript-eslint/array-type": "error",
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {"prefer": "type-imports"}
            ],
            "@typescript-eslint/prefer-nullish-coalescing": "error",
            "@typescript-eslint/prefer-optional-chain": "error",
            "@typescript-eslint/no-non-null-assertion": "error",
            "@typescript-eslint/member-ordering": "error",
            "@typescript-eslint/naming-convention": [
                "error",
                {"selector": "typeLike",
                    "format": ["PascalCase"]},
                {"selector": "variable",
                    "format": [
                        "camelCase",
                        "UPPER_CASE"
                    ]},
                {"selector": "function",
                    "format": ["camelCase"]},
                {"selector": "classProperty",
                    "format": ["camelCase"],
                    "leadingUnderscore": "allow"},
                {"selector": "parameter",
                    "format": ["camelCase"],
                    "leadingUnderscore": "allow"}
            ],
            "@stylistic/indent": [
                "error",
                4,
                {"SwitchCase": 1}
            ],
            "@stylistic/quotes": [
                "error",
                "double"
            ],
            "@stylistic/semi": [
                "error",
                "always"
            ]
        }
    }
]);
