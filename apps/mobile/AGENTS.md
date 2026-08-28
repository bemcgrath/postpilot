# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

This app is pinned to SDK 54, not the newest SDK -- verified against a real
device during the mobile plan's M0 spike (the App Store's current Expo Go
build didn't support the SDK that `create-expo-app@latest` scaffolds by
default). Don't upgrade without re-validating on a real device first.

This app is a workspace member of the PostPilot monorepo
(`C:\Users\brian_tbcxf8g\Projects\postpilot`), consuming the pure scoring
engine from the sibling `@postpilot/core` package (`packages/core/`) via a
real npm workspace dependency -- see that package's `src/scoring/`,
`src/learning/`, `src/config/`, `src/storage/` for what's available.
