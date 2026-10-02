import ExpoModulesCore

// iOS stub: background bells are Android-only for now (iOS needs its own
// audio-session work); this keeps the iOS build compiling.
public class RoundBellsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RoundBells")

    Function("start") { (_: String) -> Bool in
      return false
    }

    Function("stop") {}
  }
}
