// SPDX-License-Identifier: GPL-3.0-or-later
import ActivityKit
import Foundation
struct VPNActivity: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var location: String
        var downloaded: Int64
        var uploaded: Int64
        var startedAt: Date
        var updatedAt: Date
    }
    var name: String = "Fox VPN"
}
enum LiveStatus {
    static func update(_ session: SessionSnapshot) async {
        let value = VPNActivity.ContentState(location: session.location, downloaded: session.downloaded, uploaded: session.uploaded, startedAt: session.startedAt, updatedAt: session.updatedAt)
        for activity in Activity<VPNActivity>.activities {
            if session.connected { await activity.update(ActivityContent(state: value, staleDate: Date().addingTimeInterval(30))) }
            else { await activity.end(ActivityContent(state: value, staleDate: nil), dismissalPolicy: .immediate) }
        }
    }
}
