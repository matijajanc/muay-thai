Pod::Spec.new do |s|
  s.name           = 'RoundBells'
  s.version        = '1.0.0'
  s.summary        = 'Round-timer bells while the app is in the background (Android; iOS is a stub)'
  s.description    = 'Round-timer bells while the app is in the background (Android; iOS is a stub)'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
