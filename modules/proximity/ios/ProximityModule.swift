import ExpoModulesCore

// iOS stub. iOS blanks the screen while the proximity sensor is covered, so
// wave gestures are Android-only for now; this keeps the iOS build compiling.
public class ProximityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Proximity")

    Events("onChange")

    Function("isAvailable") {
      return false
    }

    Function("maxRange") {
      return 0.0
    }
  }
}
