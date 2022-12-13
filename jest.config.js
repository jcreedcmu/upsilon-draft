module.exports = {
  transform: {
    '^.+\\.ts?$':
    ['ts-jest',
     {
       isolatedModules: true,
     }
    ]
  },
  testEnvironment: 'node',
  testRegex: '/tests/.*\\.(ts|tsx)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node']
};
