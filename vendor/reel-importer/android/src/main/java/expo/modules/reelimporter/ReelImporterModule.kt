package expo.modules.reelimporter

import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLException
import com.yausername.youtubedl_android.YoutubeDLRequest
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.io.File

class ReelImporterModule : Module() {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun definition() = ModuleDefinition {
        Name("ReelImporter")

        AsyncFunction("downloadPublicVideo") { url: String, promise: Promise ->
            scope.launch {
                try {
                    val parsedUrl = java.net.URL(url)
                    if (parsedUrl.protocol != "https" && parsedUrl.protocol != "http") {
                        throw IllegalArgumentException("Use a public http or https video link.")
                    }

                    val context = appContext.reactContext
                        ?: throw IllegalStateException("Reel Reactor is still opening. Try importing the link again in a moment.")
                    YoutubeDL.getInstance().init(context)

                    val importsDirectory = File(context.cacheDir, "reel-reactor-imports")
                    if (!importsDirectory.exists() && !importsDirectory.mkdirs()) {
                        throw IllegalStateException("Reel Reactor could not create local video storage.")
                    }

                    val startedAt = System.currentTimeMillis()
                    val outputTemplate = File(importsDirectory, "reaction-source-$startedAt.%(ext)s").absolutePath
                    val request = YoutubeDLRequest(url)
                    request.addOption("--no-playlist")
                    request.addOption("--no-mtime")
                    request.addOption("--restrict-filenames")
                    request.addOption("-f", "best[ext=mp4][acodec!=none][vcodec!=none]/best[acodec!=none][vcodec!=none]")
                    request.addOption("-o", outputTemplate)
                    YoutubeDL.getInstance().execute(request)

                    val imported = importsDirectory.listFiles()
                        ?.filter { it.isFile && it.lastModified() >= startedAt - 2_000L && it.length() > 0L }
                        ?.maxByOrNull { it.lastModified() }
                        ?: throw IllegalStateException("The shared link did not produce a playable local video.")

                    promise.resolve(mapOf(
                        "uri" to "file://${imported.absolutePath}",
                        "fileName" to imported.name,
                        "size" to imported.length()
                    ))
                } catch (error: YoutubeDLException) {
                    promise.reject(
                        "PUBLIC_LINK_UNAVAILABLE",
                        "This link could not be downloaded on this phone. It may be private, require a Facebook login, or no longer expose a playable video. Choose a saved copy instead.",
                        error
                    )
                } catch (error: Exception) {
                    promise.reject("PUBLIC_LINK_IMPORT_FAILED", error.message ?: "The public link could not be imported.", error)
                }
            }
        }

        OnDestroy {
            scope.cancel()
        }
    }
}
