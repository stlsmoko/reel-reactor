"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FFmpegCancelledError = exports.FFmpegError = void 0;
exports.run = run;
exports.execute = execute;
exports.getVersion = getVersion;
const expo_modules_core_1 = require("expo-modules-core");
const ExpoFFmpegModule = (0, expo_modules_core_1.requireNativeModule)('ExpoFFmpeg');
const emitter = new expo_modules_core_1.EventEmitter(ExpoFFmpegModule);
const LOG_LEVELS = [
    'quiet',
    'panic',
    'fatal',
    'error',
    'warning',
    'info',
    'verbose',
    'debug',
    'trace',
];
function generateSessionId() {
    return `ffmpeg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
/**
 * Execute an FFmpeg command
 *
 * @param args FFmpeg arguments (without 'ffmpeg' prefix)
 * @param options Execution options
 * @returns Session object with cancel capability and result promise
 *
 * @example
 * ```typescript
 * const session = run([
 *   '-i', inputPath,
 *   '-y',
 *   outputPath
 * ], {
 *   onProgress: (p) => console.log(`${p.time}ms processed`)
 * });
 *
 * const result = await session.result;
 * ```
 */
function run(args, options = {}) {
    const sessionId = generateSessionId();
    const { onProgress, onLog, logLevel = 'warning', env } = options;
    const subscriptions = [];
    if (onProgress) {
        const subscription = emitter.addListener('onProgress', (event) => {
            if (event.sessionId === sessionId) {
                onProgress(event);
            }
        });
        subscriptions.push(() => subscription.remove());
    }
    if (onLog) {
        const subscription = emitter.addListener('onLog', (event) => {
            if (event.sessionId === sessionId) {
                onLog(event);
            }
        });
        subscriptions.push(() => subscription.remove());
    }
    const cleanup = () => {
        subscriptions.forEach((unsub) => unsub());
    };
    const resultPromise = ExpoFFmpegModule.run(sessionId, args, {
        logLevel: LOG_LEVELS.indexOf(logLevel),
        environmentVariables: env,
    }).finally(cleanup);
    return {
        id: sessionId,
        cancel: () => ExpoFFmpegModule.cancel(sessionId),
        result: resultPromise,
    };
}
/**
 * Execute an FFmpeg command and await the result
 *
 * @param args FFmpeg arguments (without 'ffmpeg' prefix)
 * @param options Execution options
 * @returns Promise resolving to the execution result
 * @throws FFmpegError if the command fails
 *
 * @example
 * ```typescript
 * try {
 *   const result = await execute(['-i', input, '-y', output]);
 *   console.log('Success!', result.duration);
 * } catch (error) {
 *   if (error instanceof FFmpegError) {
 *     console.error('FFmpeg failed:', error.output);
 *   }
 * }
 * ```
 */
async function execute(args, options) {
    const session = run(args, options);
    const result = await session.result;
    if (result.returnCode !== 0) {
        throw new FFmpegError(`FFmpeg exited with code ${result.returnCode}`, result.returnCode, result.output);
    }
    return result;
}
/**
 * Get FFmpeg version information
 */
function getVersion() {
    const versionString = ExpoFFmpegModule.getVersion();
    const match = versionString.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
    return {
        version: versionString,
        major: match ? parseInt(match[1], 10) : 0,
        minor: match ? parseInt(match[2], 10) : 0,
        patch: match && match[3] ? parseInt(match[3], 10) : 0,
    };
}
/**
 * Error thrown when FFmpeg command fails
 */
class FFmpegError extends Error {
    constructor(message, returnCode, output) {
        super(message);
        this.returnCode = returnCode;
        this.output = output;
        this.name = 'FFmpegError';
    }
}
exports.FFmpegError = FFmpegError;
/**
 * Error thrown when FFmpeg session is cancelled
 */
class FFmpegCancelledError extends Error {
    constructor(sessionId) {
        super(`FFmpeg session ${sessionId} was cancelled`);
        this.sessionId = sessionId;
        this.name = 'FFmpegCancelledError';
    }
}
exports.FFmpegCancelledError = FFmpegCancelledError;
//# sourceMappingURL=ExpoFFmpeg.js.map