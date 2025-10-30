Pod::Spec.new do |s|
  s.name         = 'ffmpeg-kit-ios-https'
  s.version      = '6.0'
  s.summary      = 'FFmpegKit iOS HTTPS XCFramework'
  s.description  = 'FFmpegKit iOS HTTPS build used by ffmpeg-kit-react-native.'
  s.homepage     = 'https://github.com/arthenica/ffmpeg-kit'
  s.license      = { :type => 'LGPL-3.0', :file => 'LICENSE' }
  s.author       = { 'Arthenica' => 'support@arthenica.com' }
  s.platform     = :ios, '12.1'
  s.source       = { :http => 'https://github.com/arthenica/ffmpeg-kit/releases/download/v6.0/ffmpeg-kit-https-6.0-ios-xcframework.zip' }
  s.vendored_frameworks = 'ffmpeg-kit-https.xcframework'
  s.requires_arc = true
end