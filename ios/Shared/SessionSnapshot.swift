// SPDX-License-Identifier: GPL-3.0-or-later
import Foundation
struct SessionSnapshot: Codable, Equatable {
    var connected = false
    var location = ""
    var downloaded: Int64 = 0
    var uploaded: Int64 = 0
    var startedAt = Date()
    var updatedAt = Date()
    static func from(_ state: [String: Any]) -> Self {
        let server = state["activeServer"] as? [String: Any] ?? [:]
        let exit = state["exit"] as? [String: Any] ?? [:]
        let code = exit["country"] as? String ?? ""
        let actual = !code.isEmpty && code != server["code"] as? String
        let country = actual ? Locale(identifier: "en_US").localizedString(forRegionCode: code) ?? code : server["country"] as? String ?? ""
        let city = actual ? "" : (server["city"] as? String ?? "").trimmingCharacters(in: .whitespaces)
        let label = city.isEmpty || city.caseInsensitiveCompare(country) == .orderedSame ? country : [country, city].filter { !$0.isEmpty }.joined(separator: ", ")
        return Self(connected: state["connection"] as? String == "connected", location: label,
                    downloaded: (state["down"] as? NSNumber)?.int64Value ?? 0,
                    uploaded: (state["up"] as? NSNumber)?.int64Value ?? 0,
                    startedAt: Date(timeIntervalSince1970: ((state["startedAt"] as? NSNumber)?.doubleValue ?? Date().timeIntervalSince1970 * 1000) / 1000))
    }
    static func bytes(_ raw: Int64) -> String {
        var value = Double(max(0, raw)); let units = ["B", "KB", "MB", "GB", "TB"]; var index = 0
        while value >= 1024 && index < units.count - 1 { value /= 1024; index += 1 }
        return String(format: index == 0 ? "%.0f %@" : "%.1f %@", locale: Locale(identifier: "en_US"), value, units[index])
    }
}
