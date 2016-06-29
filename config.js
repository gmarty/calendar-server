const path = require('path');

function getUserConfig() {
  // TODO use strip-json-comments to simplify this code.
  const USER_CONFIG_PATH = './config/config.js';
  let userConfig = {};

  try {
    userConfig = require(USER_CONFIG_PATH);
  } catch (e) {
    if (e.message !== `Cannot find module '${USER_CONFIG_PATH}'`) {
      throw e;
    }
  }

  if (userConfig.profile) {
    userConfig.profile = path.join(__dirname, userConfig.profile);
  }

  return userConfig;
}


const config = require('minimist')(
  process.argv.slice(2),
  {
    default: Object.assign({
      httpPort: 3000,
      mqPort: 4000,
      notificationPoll: 60 * 1000,
      profile: path.join(__dirname, 'profiles/development')
    }, getUserConfig())
  }
);

if (!path.isAbsolute(config.profile)) {
  config.profile = path.join(process.cwd(), config.profile);
}

require('mkdirp').sync(config.profile);

module.exports = config;
