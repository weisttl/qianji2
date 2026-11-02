import { ExpoConfig, ConfigContext } from 'expo/config';

import VERSION from './versions/version.json';

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: 'Qianji Mobile',
    slug: 'qianji-mobile',
    version: VERSION.version,
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'qianji-mobile',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.qianji.mobile',
      buildNumber: String(VERSION.buildNumber),
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: 'Qianji needs camera access to scan QR codes for server login.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/icon.png',
        backgroundColor: '#004E97',
      },
      package: 'com.qianji.mobile',
      versionCode: VERSION.buildNumber,
    },
    web: {
      output: 'static',
      favicon: './assets/images/icon.png',
    },
    plugins: ['expo-router', 'expo-secure-store', 'expo-dev-client', 'expo-camera'],
    experiments: {
      typedRoutes: true,
    },

  };
};
