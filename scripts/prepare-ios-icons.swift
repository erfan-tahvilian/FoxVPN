// SPDX-License-Identifier: GPL-3.0-or-later
import AppKit
import Foundation
let root=URL(fileURLWithPath:FileManager.default.currentDirectoryPath)
let output=root.appendingPathComponent("ios/Generated/Assets.xcassets/AppIcon.appiconset")
try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
guard let logo=NSImage(contentsOf:root.appendingPathComponent("assets/logo-light.png")) else{fatalError("Missing logo")}
let size=1024
let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:size,pixelsHigh:size,bitsPerSample:8,samplesPerPixel:3,hasAlpha:false,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:bitmap)
NSColor(calibratedRed:0.063,green:0.067,blue:0.09,alpha:1).setFill();NSBezierPath(rect:NSRect(x:0,y:0,width:size,height:size)).fill()
logo.draw(in:NSRect(x:112,y:112,width:800,height:800),from:.zero,operation:.sourceOver,fraction:1)
NSGraphicsContext.restoreGraphicsState()
try bitmap.representation(using:.png,properties:[:])!.write(to:output.appendingPathComponent("AppIcon.png"))
let contents:[String:Any] = ["images":[["filename":"AppIcon.png","idiom":"universal","platform":"ios","size":"1024x1024"]],"info":["author":"xcode","version":1]]
try JSONSerialization.data(withJSONObject:contents,options:.prettyPrinted).write(to:output.appendingPathComponent("Contents.json"))
try Data("{\"info\":{\"author\":\"xcode\",\"version\":1}}".utf8).write(to:output.deletingLastPathComponent().appendingPathComponent("Contents.json"))

let assets=output.deletingLastPathComponent()
let launch=assets.appendingPathComponent("LaunchLogo.imageset");try FileManager.default.createDirectory(at:launch,withIntermediateDirectories:true)
for (source,destination) in [("logo.png","light.png"),("logo-light.png","dark.png")] {let to=launch.appendingPathComponent(destination);try?FileManager.default.removeItem(at:to);try FileManager.default.copyItem(at:root.appendingPathComponent("assets/"+source),to:to)}
let launchInfo:[String:Any] = ["images":[["filename":"light.png","idiom":"universal"],["filename":"dark.png","idiom":"universal","appearances":[["appearance":"luminosity","value":"dark"]]]],"info":["author":"xcode","version":1]]
try JSONSerialization.data(withJSONObject:launchInfo).write(to:launch.appendingPathComponent("Contents.json"))
let background=assets.appendingPathComponent("LaunchBackground.colorset");try FileManager.default.createDirectory(at:background,withIntermediateDirectories:true)
let colorInfo:[String:Any] = ["colors":[["idiom":"universal","color":["color-space":"srgb","components":["red":"0.969","green":"0.973","blue":"0.980","alpha":"1.0"]]],["idiom":"universal","appearances":[["appearance":"luminosity","value":"dark"]],"color":["color-space":"srgb","components":["red":"0.063","green":"0.067","blue":"0.090","alpha":"1.0"]]]],"info":["author":"xcode","version":1]]
try JSONSerialization.data(withJSONObject:colorInfo).write(to:background.appendingPathComponent("Contents.json"))
