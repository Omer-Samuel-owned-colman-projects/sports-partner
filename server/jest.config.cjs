const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.test'), quiet: true });

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'node',
          esModuleInterop: true,
          isolatedModules: true,
          strict: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  clearMocks: true,
  restoreMocks: true,
};
