import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: ["public/rhwp-studio/**"],
  },
  ...nextVitals,
  ...nextTs,
];

export default eslintConfig;
