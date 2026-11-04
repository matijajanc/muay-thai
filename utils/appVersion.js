import * as Application from 'expo-application';

// The installed build the way Settings and the voice log name it: "1.0.1 (6)",
// the version name from app.json and the build number EAS gave it (Android
// versionCode). See RELEASING.md. Null where there's no native app (web).
export function appVersionLabel(
  name = Application.nativeApplicationVersion,
  build = Application.nativeBuildVersion,
) {
  if (!name) return null;
  return build ? `${name} (${build})` : name;
}
