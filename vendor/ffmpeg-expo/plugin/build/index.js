"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withFFmpegIOS = exports.withFFmpegAndroid = void 0;
const config_plugins_1 = require("@expo/config-plugins");
const withFFmpegAndroid_1 = require("./withFFmpegAndroid");
const withFFmpegIOS_1 = require("./withFFmpegIOS");
const pkg = require('../../package.json');
const withFFmpeg = (config, props = {}) => {
    const { includeX86 = false, binaryUrl, ndkVersion, } = props || {};
    config = (0, withFFmpegAndroid_1.withFFmpegAndroid)(config, { includeX86, ndkVersion });
    config = (0, withFFmpegIOS_1.withFFmpegIOS)(config, { binaryUrl });
    return config;
};
exports.default = (0, config_plugins_1.createRunOncePlugin)(withFFmpeg, pkg.name, pkg.version);
var withFFmpegAndroid_2 = require("./withFFmpegAndroid");
Object.defineProperty(exports, "withFFmpegAndroid", { enumerable: true, get: function () { return withFFmpegAndroid_2.withFFmpegAndroid; } });
var withFFmpegIOS_2 = require("./withFFmpegIOS");
Object.defineProperty(exports, "withFFmpegIOS", { enumerable: true, get: function () { return withFFmpegIOS_2.withFFmpegIOS; } });
//# sourceMappingURL=index.js.map