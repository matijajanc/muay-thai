// Expo's default Metro config plus Sentry's debug IDs, which tie each release
// bundle to the source maps uploaded during the EAS build.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
