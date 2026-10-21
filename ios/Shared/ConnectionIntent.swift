// SPDX-License-Identifier: GPL-3.0-or-later
import AppIntents
import WidgetKit
import ActivityKit

// LiveActivityIntent executes in the containing app, so both targets include this type.
struct SetVPNConnection: SetValueIntent, LiveActivityIntent {
    static var title: LocalizedStringResource = "Set Fox VPN connection"
    static var description = IntentDescription("Connect or disconnect Fox VPN using your saved location.")
    @Parameter(title: "Connected") var value: Bool
    init() {}
    init(value: Bool) { self.value = value }
    @MainActor func perform() async throws -> some IntentResult {
        try await VPNProfile.setConnected(value)
        ControlCenter.shared.reloadControls(ofKind: SharedStore.controlKind)
        if !value { await LiveStatus.update(SessionSnapshot()); return .result() }
        // The intent may create a Live Activity without bringing the app onscreen.
        let manager = try await VPNProfile.load()
        for attempt in 0..<60 {
            if manager?.connection.status == .connected,
               let snapshot = SharedStore.readSnapshot(), snapshot.connected,
               Date().timeIntervalSince(snapshot.updatedAt) < 15 {
                LiveStatus.start(snapshot); break
            }
            if attempt > 3 && (manager?.connection.status == .disconnected || manager?.connection.status == .invalid) { break }
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        ControlCenter.shared.reloadControls(ofKind: SharedStore.controlKind)
        return .result()
    }
}
