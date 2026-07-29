import { fileURLToPath } from 'url';
import { dirname } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));

export default {
  plugins: {
    tailwindcss: { config: `${dir}/tailwind.config.js` },
    autoprefixer: {},
  },
};
