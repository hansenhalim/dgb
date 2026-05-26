const VARIANT = process.env.APP_VARIANT ?? "development";

const variants = {
  development: {
    package: "local.dgb",
    backgroundColor: "#7D3333",
  },
  staging: {
    package: "id.my.hann.dgb",
    backgroundColor: "#333E7D",
  },
  production: {
    package: "com.p3villacitra.dgb",
    backgroundColor: "#2E7D32",
  },
};

const v = variants[VARIANT] ?? variants.development;

export default {
  expo: {
    name: "DGB",
    slug: "dgb-app",
    version: "2.0.0",
    orientation: "portrait",
    updates: {
      url: "https://u.expo.dev/6668960c-e087-49a7-988d-a0d71202c133",
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    icon: "./assets/images/icon.png",
    scheme: "dgbapp",
    userInterfaceStyle: "automatic",
    android: {
      adaptiveIcon: {
        backgroundColor: v.backgroundColor,
        foregroundImage: "./assets/images/icon-foreground.png",
      },
      package: v.package,
    },
    plugins: [
      "@logrocket/react-native",
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#FFFFFF",
          android: {
            image: "./assets/images/icon.png",
            imageWidth: 200,
          },
        },
      ],
      "expo-secure-store",
      "expo-image",
      "react-native-ble-plx",
      [
        "expo-camera",
        {
          barcodeScannerEnabled: false,
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 25,
            buildArchs: ["arm64-v8a"],
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "6668960c-e087-49a7-988d-a0d71202c133",
      },
    },
  },
};
