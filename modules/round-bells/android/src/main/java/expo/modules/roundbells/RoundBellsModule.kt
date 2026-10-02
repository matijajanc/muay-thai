package expo.modules.roundbells

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Starts and stops RoundBellsService, which rings a running round timer's cues
// while the app is in the background (React Native's timers stop there). The
// app rings them itself while it's visible, so the service stays quiet then.
class RoundBellsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RoundBells")

    // plan: JSON from utils/backgroundBells.js bellPlan() plus { sounds:
    // { name: file path } }. Replaces any plan already running. → false if
    // Android refused to start the service (only allowed from the foreground).
    Function("start") { plan: String ->
      val context = appContext.reactContext ?: return@Function false
      val intent = Intent(context, RoundBellsService::class.java)
        .putExtra(RoundBellsService.EXTRA_PLAN, plan)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
        true
      } catch (e: Exception) {
        false
      }
    }

    Function("stop") {
      appContext.reactContext?.let { it.stopService(Intent(it, RoundBellsService::class.java)) }
      Unit
    }

    OnActivityEntersForeground {
      RoundBellsService.appVisible = true
    }

    OnActivityEntersBackground {
      RoundBellsService.appVisible = false
    }
  }
}
