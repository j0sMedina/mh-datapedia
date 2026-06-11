import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/tests/**/*.test.ts'],
  globalSetup: './tests/globalSetup.ts',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { rootDir: '.' } }],
  },
};

export default config;
