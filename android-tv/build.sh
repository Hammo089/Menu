#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")" && pwd)"
TASK_SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/workspace/android-sdk}}"
TASK_TOOLS="$TASK_SDK/build-tools/35.0.0"
TASK_OUT="$TASK_ROOT/build"
TASK_PLATFORM="$TASK_SDK/platforms/android-34/android.jar"
for item in "$TASK_TOOLS/aapt2" "$TASK_TOOLS/d8" "$TASK_TOOLS/apksigner" "$TASK_PLATFORM"; do
 if [ ! -f "$item" ]; then echo "Missing Android SDK tool: $item" >&2; exit 1; fi
done
node "$TASK_ROOT/scripts/prepare-assets.mjs"
rm -rf "$TASK_OUT/classes" "$TASK_OUT/dex"
mkdir -p "$TASK_OUT/classes" "$TASK_OUT/dex" "$TASK_ROOT/dist" "$TASK_ROOT/.signing"
find "$TASK_ROOT/app/src/main/java" -name '*.java' > "$TASK_OUT/sources.txt"
javac --release 8 -classpath "$TASK_PLATFORM" -d "$TASK_OUT/classes" @"$TASK_OUT/sources.txt"
jar --create --file "$TASK_OUT/classes.jar" -C "$TASK_OUT/classes" .
"$TASK_TOOLS/d8" --lib "$TASK_PLATFORM" --min-api 26 --output "$TASK_OUT/dex" "$TASK_OUT/classes.jar"
"$TASK_TOOLS/aapt2" compile --dir "$TASK_ROOT/app/src/main/res" -o "$TASK_OUT/resources.zip"
"$TASK_TOOLS/aapt2" link -I "$TASK_PLATFORM" --manifest "$TASK_ROOT/app/src/main/AndroidManifest.xml" -A "$TASK_ROOT/app/src/main/assets" --auto-add-overlay -o "$TASK_OUT/base.apk" "$TASK_OUT/resources.zip"
cp "$TASK_OUT/base.apk" "$TASK_OUT/unsigned.apk"
(cd "$TASK_OUT/dex" && zip -q "$TASK_OUT/unsigned.apk" classes.dex)
"$TASK_TOOLS/zipalign" -f 4 "$TASK_OUT/unsigned.apk" "$TASK_OUT/aligned.apk"
# Pilot signer only. Do not use this development identity for managed production devices.
TASK_KEY="$TASK_ROOT/.signing/pilot.jks"
if [ ! -f "$TASK_KEY" ]; then keytool -genkeypair -keystore "$TASK_KEY" -storepass android -keypass android -alias androiddebugkey -dname 'CN=Blanco TV Pilot,O=Development,C=FR' -keyalg RSA -keysize 2048 -validity 3650 >/dev/null 2>&1; fi
"$TASK_TOOLS/apksigner" sign --ks "$TASK_KEY" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "$TASK_ROOT/dist/blanco-tv-pilot.apk" "$TASK_OUT/aligned.apk"
"$TASK_TOOLS/apksigner" verify --verbose "$TASK_ROOT/dist/blanco-tv-pilot.apk"
(cd "$TASK_ROOT/dist" && sha256sum blanco-tv-pilot.apk) > "$TASK_ROOT/dist/SHA256SUMS"
echo "Built $TASK_ROOT/dist/blanco-tv-pilot.apk (pilot; test on the actual TV before use)."
