import type { FFmpegResult, FFmpegSession, FFmpegVersion, RunOptions } from './ExpoFFmpeg.types';
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
export declare function run(args: string[], options?: RunOptions): FFmpegSession;
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
export declare function execute(args: string[], options?: RunOptions): Promise<FFmpegResult>;
/**
 * Get FFmpeg version information
 */
export declare function getVersion(): FFmpegVersion;
/**
 * Error thrown when FFmpeg command fails
 */
export declare class FFmpegError extends Error {
    readonly returnCode: number;
    readonly output: string;
    constructor(message: string, returnCode: number, output: string);
}
/**
 * Error thrown when FFmpeg session is cancelled
 */
export declare class FFmpegCancelledError extends Error {
    readonly sessionId: string;
    constructor(sessionId: string);
}
//# sourceMappingURL=ExpoFFmpeg.d.ts.map