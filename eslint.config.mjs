import coreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...coreWebVitals,
  {
    ignores: [".next/**", "out/**", "build/**", "src/components/ui/**"],
  },
];

export default eslintConfig;
