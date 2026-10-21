// SPDX-License-Identifier: GPL-3.0-or-later
import Foundation
import Security
import NetworkExtension

enum VPNError: LocalizedError {
    case configuration(String)
    var errorDescription: String? { switch self { case .configuration(let message): return message } }
}
enum SharedStore {
    static var group: String { Bundle.main.object(forInfoDictionaryKey: "FoxAppGroup") as? String ?? "group.com.foxvpn.ios" }
    static var bundleID: String { Bundle.main.object(forInfoDictionaryKey: "FoxContainerBundleID") as? String ?? "com.foxvpn.ios" }
    static var providerID: String { bundleID + ".tunnel" }
    static let controlKind = "com.foxvpn.ios.connection"
    static func directory() throws -> URL {
        if let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) { return url }
        #if targetEnvironment(simulator)
        let url = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("FoxVPNSimulator")
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true); return url
        #else
        throw VPNError.configuration("The signed build is missing its App Group entitlement.")
        #endif
    }
    static func readSnapshot() -> SessionSnapshot? {
        guard let url = try? directory().appendingPathComponent("session-status.json"), let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(SessionSnapshot.self, from: data)
    }
    static func writeSnapshot(_ value: SessionSnapshot) throws {
        let url = try directory().appendingPathComponent("session-status.json")
        try JSONEncoder().encode(value).write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
    private static var keychainQuery: [String: Any] {
        var query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "FoxVPN.Session", kSecAttrAccount as String: "vault"]
        #if !targetEnvironment(simulator)
        if let group = Bundle.main.object(forInfoDictionaryKey: "FoxKeychainGroup") as? String { query[kSecAttrAccessGroup as String] = group }
        #endif
        return query
    }
    static func readVault() throws -> String {
        var query = keychainQuery; query[kSecReturnData as String] = true; query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?; let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return "{}" }
        guard status == errSecSuccess, let data = item as? Data, let text = String(data: data, encoding: .utf8) else { throw VPNError.configuration("Keychain session could not be read (\(status)).") }
        return text
    }
    static func writeVault(_ text: String) throws {
        guard let data = text.data(using: .utf8) else { throw VPNError.configuration("Invalid session encoding.") }
        let query = keychainQuery
        let attributes: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound { status = SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil) }
        guard status == errSecSuccess else { throw VPNError.configuration("Keychain session could not be saved (\(status)).") }
    }
    static func signedIn() -> Bool {
        guard let data = try? readVault().data(using: .utf8), let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let auth = value["auth"] as? [String: Any] else { return false }
        return !(auth["access_token"] as? String ?? "").isEmpty
    }
}

@MainActor enum VPNProfile {
    static func load(create: Bool = false) async throws -> NETunnelProviderManager? {
        let profiles = try await NETunnelProviderManager.loadAllFromPreferences()
        if let found = profiles.first(where: { ($0.protocolConfiguration as? NETunnelProviderProtocol)?.providerBundleIdentifier == SharedStore.providerID }) { return found }
        guard create else { return nil }
        let manager = NETunnelProviderManager(); let configuration = NETunnelProviderProtocol()
        configuration.providerBundleIdentifier = SharedStore.providerID; configuration.serverAddress = "Fox VPN"
        configuration.excludeLocalNetworks = true
        manager.protocolConfiguration = configuration; manager.localizedDescription = "Fox VPN"; manager.isEnabled = true
        try await manager.saveToPreferences(); try await manager.loadFromPreferences(); return manager
    }
    static func setConnected(_ connected: Bool) async throws {
        guard let manager = try await load() else { throw VPNError.configuration("Open Fox VPN and connect once to configure VPN access.") }
        if connected {
            guard SharedStore.signedIn() else { throw VPNError.configuration("Open Fox VPN and sign in first.") }
            if manager.connection.status == .connected || manager.connection.status == .connecting { return }
            manager.isEnabled = true; try await manager.saveToPreferences(); try await manager.loadFromPreferences()
            try manager.connection.startVPNTunnel()
        } else { manager.connection.stopVPNTunnel() }
    }
}
