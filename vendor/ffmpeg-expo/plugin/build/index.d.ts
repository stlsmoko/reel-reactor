import { ConfigPlugin } from '@expo/config-plugins';
export interface FFmpegPluginProps {
    /**
     * Include x86_64 ABI for Android emulators (increases APK size)
     * @default false
     */
    includeX86?: boolean;
    /**
     * Reserved/experimental. Currently only written to iOS Podfile properties;
     * the postinstall downloader does not consume it.
     */
    binaryUrl?: string;
    /**
     * Android-specific NDK version. When unset, the Expo/Android Gradle defaults are used.
     */
    ndkVersion?: string;
}
declare const _default: ConfigPlugin<void | FFmpegPluginProps>;
export default _default;
export { withFFmpegAndroid } from './withFFmpegAndroid';
export { withFFmpegIOS } from './withFFmpegIOS';
