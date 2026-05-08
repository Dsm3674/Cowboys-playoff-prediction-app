module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'clutch.js',
    'routes/players.js',
    'cache.js',
    'Maps.js',
    '!node_modules/**',
  ],
  testMatch: ['**/__tests__/**/*.js', '**/*.test.js', '**/*.spec.js'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  testTimeout: 10000,
  coveragePathIgnorePatterns: ['/node_modules/'],
  coverageThresholds: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
