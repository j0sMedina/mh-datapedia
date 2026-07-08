# Sharing the Android APK

## Build a new APK

From `apps/mobile`:

```
cd D:/Programacion/VSCode/mh-datapedia/apps/mobile
eas build -p android --profile preview
```

Takes ~5-10 minutes. When done, you'll get a link to the build on expo.dev.

## Download and share

1. Open the build link on expo.dev
2. Click **Download** to get the `.apk` file
3. Send it to friends via WhatsApp, Google Drive, email, etc.

Friends need to enable **"Install from unknown sources"** on their Android phone when prompted.

## Notes

- Every new build replaces the previous one — friends need to reinstall to get updates
- iOS is not supported with this setup (would require Apple Developer account)
- The app connects to the live API at `mh-datapedia-web.fly.dev`
