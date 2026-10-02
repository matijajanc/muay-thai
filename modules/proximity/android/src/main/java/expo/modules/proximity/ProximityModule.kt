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
// The listeners are only registered while JS listens and the activity is in the
// foreground. Reading the sensor needs no permission and doesn't turn the
// screen off (that's a separate wake lock the app never takes).
//
// Some phones list more than one proximity sensor (a wake-up and a non-wake-up
// one) and only one of them ever changes for apps. We listen to all of them
// and, once one changes between near and far, forward only that one.
class ProximityModule : Module() {
  // Per sensor, for the Settings diagnostics.
  private class Stats {
    var readings = 0
    var value = 0f
    var near: Boolean? = null
  }

  private var observing = false
  private var registered = false
  private val stats = HashMap<Sensor, Stats>() // guarded by itself
  @Volatile private var chosen: Sensor? = null

  private val sensorManager: SensorManager?
    get() = appContext.reactContext?.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

  private val sensors: List<Sensor>
    get() = sensorManager?.getSensorList(Sensor.TYPE_PROXIMITY).orEmpty()

  private val listener = object : SensorEventListener {
    override fun onSensorChanged(event: SensorEvent) {
      val sensor = event.sensor
      val value = event.values[0]
      val maxRange = sensor.maximumRange
      val threshold = if (maxRange > 0f) min(maxRange, NEAR_CM) else NEAR_CM
      val near = value < threshold
      val changed = synchronized(stats) {
        val s = stats.getOrPut(sensor) { Stats() }
        val before = s.near
        s.readings++
        s.value = value
        s.near = near
        before != null && before != near
      }
      if (chosen == null && changed) chosen = sensor
      val c = chosen
      if (c != null && c !== sensor) return
      sendEvent(CHANGE_EVENT, mapOf("near" to near, "t" to System.currentTimeMillis().toDouble()))
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
  }

  private fun register() {
    if (registered) return
    val manager = sensorManager ?: return
    // Not any { }: it would stop registering at the first success.
    registered = sensors.map { manager.registerListener(listener, it, SensorManager.SENSOR_DELAY_UI) }
      .contains(true)
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
      sensors.isNotEmpty()
    }

    // [{ name, wakeUp, maxRange, readings, value, chosen }]: value is null
    // before the first reading.
    Function("sensors") {
      sensors.map { sensor ->
        val s = synchronized(stats) { stats[sensor]?.let { Pair(it.readings, it.value) } }
        mapOf(
          "name" to sensor.name,
          "wakeUp" to sensor.isWakeUpSensor,
          "maxRange" to sensor.maximumRange.toDouble(),
          "readings" to (s?.first ?: 0),
          "value" to s?.second?.toDouble(),
          "chosen" to (sensor === chosen)
        )
      }
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
