
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    resolver: '<rootDir>/tests_aux/mjs_resolver.js',
    testEnvironment: 'node',
    testPathIgnorePatterns: [
        'template'
    ],
    modulePathIgnorePatterns: [
        'template'
    ],
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transform: {
        '^.+\\.m?ts$': [
            'ts-jest',
            {
                useESM: true,
            },
        ],
    },
};