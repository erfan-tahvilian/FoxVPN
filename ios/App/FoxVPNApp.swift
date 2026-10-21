// SPDX-License-Identifier: GPL-3.0-or-later
import SwiftUI
@main struct FoxVPNApp: App {
    @StateObject private var service = AppService()
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.scenePhase) private var scenePhase
    var body: some Scene {
        WindowGroup {
            VPNWebView(service: service)
                .background(Color(red: 16/255, green: 17/255, blue: 23/255))
                .onAppear { service.setSystemDark(colorScheme == .dark);service.activate() }
                .onChange(of: colorScheme) { _, scheme in service.setSystemDark(scheme == .dark) }
                .onChange(of: scenePhase) { _, phase in if phase == .active { service.activate() } else { service.pause() } }
                .onOpenURL { url in if url.scheme == "foxvpn" { service.openOverview() } }
        }
    }
}
