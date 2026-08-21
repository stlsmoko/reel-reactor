import { ConfigPlugin } from '@expo/config-plugins';
interface AndroidPluginProps {
    includeX86?: boolean;
    ndkVersion?: string;
}
export declare const withFFmpegAndroid: ConfigPlugin<AndroidPluginProps>;
export {};
