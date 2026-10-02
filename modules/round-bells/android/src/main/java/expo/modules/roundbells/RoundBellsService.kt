package expo.modules.roundbells

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.SoundPool
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import org.json.JSONObject

// Foreground service for a running round timer. It shows the current phase
// with a live countdown in an ongoing notification (lock screen included), and
// while the app isn't visible it rings the run's cues itself at their
// wall-clock times. A partial wake lock keeps those times exact with the screen
// off; as a foreground service its wake lock also holds in Doze.
//
// The plan (utils/backgroundBells.js bellPlan) comes from RoundBellsModule
// whenever the run starts, resumes or jumps; pausing or stopping stops the
// service, and it stops itself a few seconds after the run's end.
class RoundBellsService : Service() {
  companion object {
    const val EXTRA_PLAN = "plan"
    private const val CHANNEL_ID = "round-timer"
    private const val NOTIFICATION_ID = 0x7247
    private const val WAKE_LOCK_TAG = "MuayThai:RoundBells"
    // Other apps' audio is ducked this long per sound (the longest cue).
    private const val DUCK_MS = 3000L
    private const val STOP_AFTER_END_MS = 5000L
    // Same buzzes as the app's (hooks/useTimerCues.js).
    private val VIBRATION = mapOf(
      "bell" to longArrayOf(0, 400),
      "bell-x3" to longArrayOf(0, 250, 70, 250, 70, 250),
    )

    // Kept up to date by RoundBellsModule: the app rings its own cues while
    // it's visible.
    @Volatile var appVisible = true
  }

  private class Cue(val at: Long, val sound: String, val vibrate: Boolean)
  private class Phase(val at: Long, val until: Long, val title: String)
  private class Plan(
    val label: String,
    val endAt: Long,
    val sounds: Map<String, String>, // cue sound → file path
    val phases: List<Phase>,
    val cues: List<Cue>,
  )

  private lateinit var thread: HandlerThread
  private lateinit var handler: Handler
  private var wakeLock: PowerManager.WakeLock? = null
  // SoundPool and its sound ids by file path; used on the handler thread only.
  private var pool: SoundPool? = null
  private val soundIds = HashMap<String, Int>()
  private var focusRequest: AudioFocusRequest? = null
  private val abandonFocus = Runnable { releaseFocus() }

  private val audioAttributes: AudioAttributes = AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_MEDIA)
    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
    .build()

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    thread = HandlerThread("RoundBells").apply { start() }
    handler = Handler(thread.looper)
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val plan = intent?.getStringExtra(EXTRA_PLAN)?.let { runCatching { parse(it) }.getOrNull() }
    val now = System.currentTimeMillis()
    // Required promptly after startForegroundService(), even when stopping.
    startInForeground(buildNotification(plan?.phases?.firstOrNull { it.until > now }, plan?.label))
    if (plan == null || plan.endAt <= now) {
      stopSelf()
      return START_NOT_STICKY
    }
    handler.removeCallbacksAndMessages(null)
    handler.post { run(plan) }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    handler.post {
      releaseFocus()
      pool?.release()
      pool = null
      soundIds.clear()
    }
    thread.quitSafely()
    wakeLock?.let { if (it.isHeld) it.release() }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    super.onDestroy()
  }

  // On the handler thread: load the sounds and aim a callback at every cue and
  // phase change still ahead.
  private fun run(plan: Plan) {
    loadSounds(plan.sounds.values)
    holdWakeLock(plan.endAt - System.currentTimeMillis() + 60_000)
    val now = System.currentTimeMillis()
    val base = SystemClock.uptimeMillis()
    val uptimeAt = { wall: Long -> base + (wall - now) }
    for (cue in plan.cues) {
      if (cue.at > now) handler.postAtTime({ ring(plan, cue) }, uptimeAt(cue.at))
    }
    for (phase in plan.phases) {
      if (phase.at > now) handler.postAtTime({ show(phase, plan.label) }, uptimeAt(phase.at))
    }
    handler.postAtTime({ stopSelf() }, uptimeAt(plan.endAt) + STOP_AFTER_END_MS)
  }

  private fun ring(plan: Plan, cue: Cue) {
    if (appVisible) return
    val id = plan.sounds[cue.sound]?.let { soundIds[it] }
    if (id != null) {
      duckOthers()
      pool?.play(id, 1f, 1f, 1, 0, 1f)
    }
    if (cue.vibrate) vibrate(VIBRATION[cue.sound] ?: longArrayOf(0, 200))
  }

  private fun loadSounds(paths: Collection<String>) {
    val sp = pool ?: SoundPool.Builder()
      .setMaxStreams(4)
      .setAudioAttributes(audioAttributes)
      .build()
      .also { pool = it }
    for (path in paths) {
      if (path !in soundIds) soundIds[path] = sp.load(path, 1)
    }
  }

  private fun duckOthers() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val audio = getSystemService(AudioManager::class.java) ?: return
    val request = focusRequest ?: AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
      .setAudioAttributes(audioAttributes)
      .build()
      .also { focusRequest = it }
    audio.requestAudioFocus(request)
    handler.removeCallbacks(abandonFocus)
    handler.postDelayed(abandonFocus, DUCK_MS)
  }

  private fun releaseFocus() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val request = focusRequest ?: return
    getSystemService(AudioManager::class.java)?.abandonAudioFocusRequest(request)
  }

  private fun vibrate(pattern: LongArray) {
    val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      getSystemService(VibratorManager::class.java)?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    } ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
    } else {
      @Suppress("DEPRECATION")
      vibrator.vibrate(pattern, -1)
    }
  }

  private fun holdWakeLock(ms: Long) {
    val lock = wakeLock ?: (getSystemService(Context.POWER_SERVICE) as PowerManager)
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG)
      .apply { setReferenceCounted(false) }
      .also { wakeLock = it }
    lock.acquire(ms.coerceAtLeast(60_000))
  }

  // ---- Notification ----

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(CHANNEL_ID, "Round timer", NotificationManager.IMPORTANCE_LOW).apply {
      description = "The running round timer. Its bells ring while the app is in the background."
      setShowBadge(false)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }
    getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
  }

  // The phase with a live countdown to its end; tapping it opens the app.
  private fun buildNotification(phase: Phase?, label: String?): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    builder
      .setSmallIcon(R.drawable.round_bells_icon)
      .setContentTitle(phase?.title ?: "Round timer")
      .setContentText(label)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setContentIntent(openAppIntent())
    if (phase != null) {
      builder.setWhen(phase.until).setShowWhen(true).setUsesChronometer(true)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) builder.setChronometerCountDown(true)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
    }
    return builder.build()
  }

  private fun show(phase: Phase, label: String) {
    getSystemService(NotificationManager::class.java)
      ?.notify(NOTIFICATION_ID, buildNotification(phase, label))
  }

  private fun startInForeground(notification: Notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun openAppIntent(): PendingIntent? {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
    return PendingIntent.getActivity(
      this, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
  }

  // ---- Plan ----

  private fun parse(json: String): Plan {
    val o = JSONObject(json)
    val sounds = HashMap<String, String>()
    o.optJSONObject("sounds")?.let { s ->
      for (key in s.keys()) Uri.parse(s.getString(key)).path?.let { sounds[key] = it }
    }
    val phases = o.getJSONArray("phases").let { a ->
      (0 until a.length()).map { i ->
        a.getJSONObject(i).let { Phase(it.getLong("at"), it.getLong("until"), it.getString("title")) }
      }
    }
    val cues = o.getJSONArray("cues").let { a ->
      (0 until a.length()).map { i ->
        a.getJSONObject(i).let { Cue(it.getLong("at"), it.getString("sound"), it.optBoolean("vibrate")) }
      }
    }
    return Plan(o.optString("label"), o.getLong("endAt"), sounds, phases, cues)
  }
}
