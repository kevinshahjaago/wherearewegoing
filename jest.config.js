/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true } }],
  },
  collectCoverageFrom: ['lib/services/**/*.ts', 'lib/schemas/**/*.ts', 'config/experience.ts'],
  coverageThreshold: {
    global: {},
    'lib/services/': { lines: 80 },
  },
}

module.exports = config
