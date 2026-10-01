package expo.modules.proximity

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.min

private const val CHANGE_EVENT = "onChange"
// Most sensors are binary (0 = near, maxRange = far); the few that report a
// real distance count as near within about 5 cm.
private const val NEAR_CM = 5f

// Proximity sensor near/far for wave gestures (hooks/useWaveGestures.js).
// The listener is only registered while JS listens and the activity is in the
// foreground. Reading the sensor needs no permission and doesn't turn the
// screen off (that's a separate wake lock the app never takes).
class ProximityModule : Module() {
  private var observing = false
  private var registered = false

  private val sensorManager: SensorManager?
    get() = appContext.reactContext?.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

  // The default proximity sensor is often a wake-up sensor; prefer the plain one.
  private val sensor: Sensor?
    get() = sensorManager?.let {
      it.getDefaultSensor(Sensor.TYPE_PROXIMITY, false) ?: it.getDefaultSensor(Sensor.TYPE_PROXIMITY)
    }

  private val listener = object : SensorEventListener {
    override fun onSensorChanged(event: SensorEvent) {
      val maxRange = event.sensor.maximumRange
      val threshold = if (maxRange > 0f) min(maxRange, NEAR_CM) else NEAR_CM
      sendEvent(
        CHANGE_EVENT,
        mapOf("near" to (event.values[0] < threshold), "t" to System.currentTimeMillis().toDouble())
      )
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
  }

  private fun register() {
    if (registered) return
    val manager = sensorManager ?: return
    val s = sensor ?: return
    registered = manager.registerListener(listener, s, SensorManager.SENSOR_DELAY_UI)
  }

  private fun unregister() {
    if (!registered) return
    sensorManager?.unregisterListener(listener)
    registered = false
  }

  override fun definition() = ModuleDefinition {
    Name("Proximity")

    Events(CHANGE_EVENT)

    Function("isAvailable") {
      sensor != null
    }

    Function("maxRange") {
      sensor?.maximumRange?.toDouble() ?: 0.0
    }

    OnStartObserving(CHANGE_EVENT) {
      observing = true
      register()
    }

    OnStopObserving(CHANGE_EVENT) {
      observing = false
      unregister()
    }

    OnActivityEntersForeground {
      if (observing) register()
    }

    OnActivityEntersBackground {
      unregister()
    }

    OnDestroy {
      unregister()
    }
  }
}
