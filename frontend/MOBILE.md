# GhassiCloud Mobile App

This project is configured to build native Android and iOS apps using Capacitor.

## Prerequisites

### For Android:
- [Android Studio](https://developer.android.com/studio) installed
- Android SDK (installed via Android Studio)
- Java JDK 17+ (usually bundled with Android Studio)

### For iOS (Mac only):
- Xcode 14+ installed from the App Store
- CocoaPods (`sudo gem install cocoapods`)

## Quick Start

### 1. Build the web app
```bash
cd frontend
npm run build
```

### 2. Sync with native platforms
```bash
npm run cap:sync
```

### 3. Open in native IDE

**Android:**
```bash
npm run cap:android
```
This opens Android Studio. Then:
1. Wait for Gradle sync to complete
2. Connect your Android device via USB (enable USB debugging in Developer Options)
3. Click the green "Run" button ▶️

**iOS (Mac only):**
```bash
npm run cap:ios
```
This opens Xcode. Then:
1. Select your development team in Signing & Capabilities
2. Connect your iPhone or select a simulator
3. Click the "Run" button ▶️

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run cap:sync` | Sync web assets to native projects |
| `npm run cap:android` | Open Android Studio |
| `npm run cap:ios` | Open Xcode |
| `npm run cap:build:android` | Build web + sync to Android |
| `npm run cap:build:ios` | Build web + sync to iOS |
| `npm run cap:run:android` | Run directly on connected Android device |
| `npm run cap:run:ios` | Run directly on connected iOS device |

## Development Workflow

1. Make changes to your React code in `src/`
2. Run `npm run build` to rebuild
3. Run `npm run cap:sync` to copy to native projects
4. Test in native IDE or on device

### Live Reload (Development)

For faster development with live reload, edit `capacitor.config.ts`:

```typescript
server: {
  url: 'http://YOUR_LOCAL_IP:3000',  // Your computer's IP
  cleartext: true
}
```

Then run `npm run dev` and rebuild the native app. Changes will reflect instantly!

## Testing on Your Phone

### Android (No Android Studio)
You can build an APK directly:
```bash
cd android
./gradlew assembleDebug
```
The APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

Transfer this file to your phone and install it (enable "Install unknown apps" in settings).

### iOS (TestFlight)
1. Archive the app in Xcode
2. Upload to App Store Connect
3. Enable TestFlight for internal testing

## Native Features Available

The app includes these native capabilities:

- **Status Bar** - Customize color and style
- **Splash Screen** - Native loading screen  
- **Haptics** - Vibration feedback
- **Keyboard** - Detect keyboard events
- **Network** - Monitor online/offline status
- **App Lifecycle** - Handle pause/resume events

### Using Native Features in Code

```jsx
import { useHaptics, useNetwork, isNative } from './hooks/useCapacitor';

function MyComponent() {
  const { impact } = useHaptics();
  const { isConnected } = useNetwork();

  const handleTap = () => {
    if (isNative) {
      impact('medium'); // Haptic feedback on tap
    }
  };

  return (
    <button onClick={handleTap}>
      {isConnected ? 'Online' : 'Offline'}
    </button>
  );
}
```

## App Icons & Splash Screens

### Generate all icon sizes
Place your source icon (1024x1024 PNG) in `resources/` then use:
```bash
npm install -g @capacitor/assets
npx capacitor-assets generate
```

### Manual placement
- Android icons: `android/app/src/main/res/mipmap-*/`
- Android splash: `android/app/src/main/res/drawable/`
- iOS icons: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- iOS splash: Configure in Xcode via LaunchScreen.storyboard

## Building for Production

### Android (Google Play)

1. Generate a signing key:
```bash
keytool -genkey -v -keystore ghassicloud-release.keystore -alias ghassicloud -keyalg RSA -keysize 2048 -validity 10000
```

2. Configure signing in `android/app/build.gradle`

3. Build release bundle:
```bash
cd android
./gradlew bundleRelease
```

The AAB file will be at: `android/app/build/outputs/bundle/release/app-release.aab`

### iOS (App Store)

1. Configure signing in Xcode
2. Product → Archive
3. Distribute to App Store Connect

## Troubleshooting

### Android build fails
- Ensure Android SDK is installed
- Try `File → Sync Project with Gradle Files` in Android Studio
- Check Java version: `java -version` (needs 17+)

### iOS build fails
- Run `cd ios/App && pod install`
- Check Xcode signing configuration
- Ensure valid Apple Developer account

### Changes not reflecting
- Run `npm run build && npm run cap:sync`
- In Android Studio: Build → Clean Project
- In Xcode: Product → Clean Build Folder

## Environment Configuration

For connecting to your backend, update the API URL based on your deployment:

```typescript
// capacitor.config.ts - for development
server: {
  url: 'http://192.168.1.100:3000'  // Your dev server
}

// For production, remove server.url and configure your deployed backend URL in the app
```
