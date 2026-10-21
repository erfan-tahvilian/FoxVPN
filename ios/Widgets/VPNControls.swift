// SPDX-License-Identifier: GPL-3.0-or-later
import SwiftUI
import WidgetKit
import AppIntents
import ActivityKit
struct VPNConnectionValue: ControlValueProvider {
    var previewValue: Bool { false }
    @MainActor func currentValue() async throws -> Bool {
        if let manager = try? await VPNProfile.load() { return manager.connection.status == .connected }
        guard let value=SharedStore.readSnapshot(),Date().timeIntervalSince(value.updatedAt)<15 else{return false}
        return value.connected
    }
}
struct VPNConnectionControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: SharedStore.controlKind, provider: VPNConnectionValue()) { connected in
            ControlWidgetToggle("Fox VPN", isOn: connected, action: SetVPNConnection()) { on in Label(on ? "Connected" : "Disconnected", systemImage: "network.badge.shield.half.filled") }
        }.displayName("Fox VPN").description("Connect or disconnect from your saved location.")
    }
}
struct VPNLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: VPNActivity.self) { context in
            VStack(alignment:.leading,spacing:10) {
                HStack { Label("Fox VPN",systemImage:"shield.lefthalf.filled").font(.headline); Spacer(); Text(context.state.location).font(.caption) }
                HStack {
                    Label(SessionSnapshot.bytes(context.state.downloaded),systemImage:"arrow.down");Spacer()
                    Label(SessionSnapshot.bytes(context.state.uploaded),systemImage:"arrow.up");Spacer()
                    Text(timerInterval:context.state.startedAt...Date.distantFuture,countsDown:false).monospacedDigit().frame(maxWidth:90)
                }.font(.subheadline)
                HStack {
                    if context.isStale { Text("Open Fox VPN to refresh usage").font(.caption).foregroundStyle(.secondary) }
                    Spacer();Button(intent:SetVPNConnection(value:false)){Text("Disconnect")}.buttonStyle(.bordered)
                }
            }.padding().activityBackgroundTint(Color(red:0.09,green:0.10,blue:0.14)).activitySystemActionForegroundColor(.orange).foregroundStyle(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading){Label(SessionSnapshot.bytes(context.state.downloaded),systemImage:"arrow.down").foregroundStyle(.orange)}
                DynamicIslandExpandedRegion(.trailing){Label(SessionSnapshot.bytes(context.state.uploaded),systemImage:"arrow.up")}
                DynamicIslandExpandedRegion(.bottom){HStack{Text(context.state.location);Spacer();Text(timerInterval:context.state.startedAt...Date.distantFuture,countsDown:false).monospacedDigit().frame(width:95)}}
            } compactLeading: {Image(systemName:"shield.lefthalf.filled").foregroundStyle(.orange)} compactTrailing: {Text(timerInterval:context.state.startedAt...Date.distantFuture,countsDown:false).monospacedDigit().frame(width:65)} minimal: {Image(systemName:"shield.lefthalf.filled").foregroundStyle(.orange)}
            .widgetURL(URL(string:"foxvpn://overview"))
        }
    }
}
@main struct FoxVPNWidgets: WidgetBundle {
    var body: some Widget { VPNConnectionControl(); VPNLiveActivity() }
}
