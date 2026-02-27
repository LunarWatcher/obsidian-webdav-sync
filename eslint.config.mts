import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
    {
        plugins: {
            obsidianmd
        },
        languageOptions: {
            globals: {
                ...globals.browser,
            },
            parserOptions: {
                projectService: {
                    allowDefaultProject: [
                        'eslint.config.js',
                        'manifest.json',
                    ]
                },
                tsconfigRootDir: import.meta.dirname,
                extraFileExtensions: ['.json']
            },
        },
    },
    // Obsidian's eslint rules are far too aggressive to be usable, so they can fuck right off. If I can't type .obsidian as an example
    // of a config folder in a string without a rule causing an extra suppression comment, the rules can fuck right off.
    // ...obsidianmd.configs.recommended,
    // {
    //     rules: {
    //         /**
    //          * The override turning sentence-case off works. The override telling it to treat URL and WebDAV as acronyms
    //          * does not. This resulted in changing it to ignoreWords, which it sure does a good job of not ignoring,
    //          * and still whines about. 
    //          * Only the off switch works, the rest does not, and this has been a grand waste of my time.
    //          * The obsidian plugin docs lied, the eslint docs lied, the only thing that was vaguely correct was the sample,
    //          * but that still requires the `plugins` block that wasn't listed or even included in the working sample plugin,
    //          * but is required for overrides to take effect.
    //          *
    //          * Who the fuck designed this shit? None of it makes any sense, and this is some of the most self-contradictory
    //          * crap I've had the misfortune of working with.
    //          *
    //          * I assume this won't shut the code scanning bot up either, but the PR has been in purgatory since
    //          * september, so I doubt it'll make any difference if I did fully comply with all their questionable
    //          * fucking standards.
    //          *
    //          * No, but seriously, what the fuck??
    //          */
    //         "obsidianmd/ui/sentence-case": [
    //             "off",
    //             {
    //                 ignoreWords: [
    //                     "WebDAV",
    //                     "URL",
    //                 ],
    //                 enforceCamelCaseLower: false,
    //             },
    //         ],
    //     }
    // },
    globalIgnores([
        "node_modules",
        "dist",
        "esbuild.config.mjs",
        "eslint.config.mts",
        "version-bump.mjs",
        "versions.json",
        "main.js",
        "env",
        "integration-test",
        "tests",
        "jest.config.js",
        "coverage",
    ]),
);
