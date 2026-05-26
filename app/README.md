# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

## Build a release APK

Run a local EAS build against the desired profile:

```bash
npx eas-cli@latest build --local -p android --profile staging
# or
npx eas-cli@latest build --local -p android --profile production
```

After the build finishes, rename the output APK to match the convention
`DGB_<Profile>_v<version>.apk` — e.g. `DGB_Staging_v2.0.0.apk` or
`DGB_Production_v2.0.0.apk`. The version must match the `version` field in
[`package.json`](./package.json).

## Ship an OTA update

JS/asset-only changes can be pushed to installed `staging` / `production`
APKs without a rebuild via EAS Update. Each of those build profiles is bound
to a same-named channel, and `runtimeVersion.policy` is `appVersion`, so
updates only reach builds whose `version` in [`package.json`](./package.json)
matches.

```bash
npx eas-cli@latest update --channel staging    --message "describe change" --environment preview
npx eas-cli@latest update --channel production --message "describe change" --environment production
```

Native changes or `version` bumps cross the runtime version and require a
fresh APK build — they cannot ship as OTA.

The `development` profile is intentionally not on a channel; the dev client
loads JS from the local Metro server, not from EAS Update.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).
