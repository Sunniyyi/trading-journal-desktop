module.exports = {
  packagerConfig: {
    asar: {
      unpackDir: 'extension'
    },
    executableName: 'Trading Journal'
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'TradingJournal',
        authors: 'Noam',
        description: 'Trading Journal desktop — V206 + FXReplay V21, compatibility-first with auto-update plumbing'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32']
    }
  ]
};
