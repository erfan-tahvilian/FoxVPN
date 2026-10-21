// SPDX-License-Identifier: GPL-3.0-or-later
import SwiftUI
import WebKit
import NetworkExtension
import ActivityKit
@preconcurrency import FoxCore
import WidgetKit

@MainActor final class AppService: ObservableObject {
    @Published private(set) var appearance = "system"
    weak var web: WKWebView?
    private var client: AppleClient?
    private let host = CoreHost()
    private let localActions = DispatchQueue(label: "com.foxvpn.ios.actions", qos: .userInitiated)
    private var timer: Timer?
    private var manager: NETunnelProviderManager?
    private var previousStatus: NEVPNStatus = .invalid
    private var polling = false
    private var systemDark = true
    private var active = false
    private var lastLocalState: [String: Any] = [:]
    private let allowed: Set<String> = ["state","login","verify","logout","servers","ping","account","settings","theme","select","connect","cancel","disconnect","exit","clearLogs","exportLogs","openLink","locationSort"]
    init() {
        host.onState = { [weak self] value in Task { @MainActor in self?.receiveLocal(value) } }
        do { try reloadClient() } catch { lastLocalState = ["error": error.localizedDescription] }
        NotificationCenter.default.addObserver(forName: .NEVPNStatusDidChange, object: nil, queue: .main) { [weak self] _ in Task { @MainActor in await self?.poll() } }
    }
    private func reloadClient() throws {
        let work = try SharedStore.directory().appendingPathComponent("engine-app").path
        client = AppleNewClient(host, try SharedStore.readVault(), work)
        guard let client else { throw VPNError.configuration("The native core could not initialize.") }
        receiveLocal(client.snapshot())
    }
    func activate() {
        active = true
        if timer == nil { timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in Task { @MainActor in await self?.poll() } } }
        Task { await poll() }
    }
    func pause() { active = false; timer?.invalidate(); timer = nil }
    func openOverview() { web?.evaluateJavaScript("if(typeof navigate==='function')navigate('home')", completionHandler: nil) }
    private var usingProvider: Bool { guard let status = manager?.connection.status else { return false }; return status != .disconnected && status != .invalid }
    private func receiveLocal(_ text: String) {
        guard let value = try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any] else { return }
        lastLocalState = value; if !usingProvider { publish(value) }
    }
    func setSystemDark(_ value: Bool) {systemDark=value;client?.setDark(value)}
    private func publish(_ input: [String: Any]) {
        var state=input;state["systemDark"]=systemDark
        if let settings=state["settings"] as? [String:Any],let theme=settings["theme"] as? String { appearance=theme }
        guard let data = try? JSONSerialization.data(withJSONObject: state), let text = String(data: data, encoding: .utf8) else { return }
        web?.evaluateJavaScript("if(window.fox)window.fox.receive(\(text))", completionHandler: nil)
        let snapshot = SessionSnapshot.from(state)
        if active && snapshot.connected { LiveStatus.start(snapshot) }
        Task { await LiveStatus.update(snapshot) }
    }
    private func providerCall(_ action: String, _ args: [Any]) async throws -> [String: Any] {
        guard let session = manager?.connection as? NETunnelProviderSession else { throw VPNError.configuration("The VPN session is unavailable.") }
        let request = try JSONSerialization.data(withJSONObject: ["action": action, "args": args])
        let data: Data = try await withCheckedThrowingContinuation { continuation in
            do { try session.sendProviderMessage(request) { data in
                guard let data else { continuation.resume(throwing: VPNError.configuration("The VPN provider did not respond.")); return }
                continuation.resume(returning: data)
            } } catch { continuation.resume(throwing: error) }
        }
        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }
    private func localCall(_ action: String, _ args: [Any]) async throws -> [String: Any] {
        guard let client else { throw VPNError.configuration("Secure session storage could not initialize. Check the app's signing capabilities.") }
        let data = try JSONSerialization.data(withJSONObject: args)
        let raw: String = await withCheckedContinuation { continuation in
            localActions.async { continuation.resume(returning: client.call(action, args: String(decoding: data, as: UTF8.self))) }
        }
        let response = try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any] ?? [:]
        receiveLocal(client.snapshot()); return response
    }
    func poll() async {
        guard !polling else { return }; polling = true; defer { polling = false }
        do {
            manager = try await VPNProfile.load()
            let status = manager?.connection.status ?? .disconnected
            if status != previousStatus {
                let old = previousStatus; previousStatus = status
                ControlCenter.shared.reloadControls(ofKind: SharedStore.controlKind)
                if status == .disconnected && old != .invalid { try reloadClient() }
            }
            if status == .connected {
                let response = try await providerCall("state", [])
                if let state = response["data"] as? [String: Any] { publish(state) }
            } else if status == .connecting || status == .reasserting || status == .disconnecting {
                var state = lastLocalState; state["connection"] = status == .disconnecting ? "disconnecting" : "connecting"; state["busy"] = false; publish(state)
            } else { if let text = client?.snapshot() { receiveLocal(text) }; await LiveStatus.update(SessionSnapshot()) }
        } catch { if !usingProvider, let text = client?.snapshot() { receiveLocal(text) } }
    }
    func request(_ action: String, args: [Any], controller: UIViewController?) async -> [String: Any] {
        guard allowed.contains(action) else { return ["ok": false, "error": "Unsupported action."] }
        do {
            if action == "openLink" {
                let links = ["source":"https://github.com/erfan-tahvilian/FoxVPN", "account":"https://accounts.firefox.com/signup", "accountSettings":"https://accounts.firefox.com/settings", "license":"https://github.com/erfan-tahvilian/FoxVPN/blob/main/LICENSE"]
                guard let key = args.first as? String, let text = links[key], let url = URL(string: text) else { throw VPNError.configuration("Unknown link.") }
                await UIApplication.shared.open(url); return ["ok": true]
            }
            if action == "exportLogs" {
                let response = try await requestState(); let state = response["data"] as? [String: Any] ?? [:]
                let logs = state["logs"] as? [[String: Any]] ?? []
                let text = logs.map { "\($0["time"] ?? "") [\($0["level"] ?? "")] \($0["message"] ?? "")" }.joined(separator: "\n")
                let share = UIActivityViewController(activityItems: [text], applicationActivities: nil)
                share.popoverPresentationController?.sourceView = controller?.view; controller?.present(share, animated: true); return ["ok": true]
            }
            if action == "connect" {
                guard (lastLocalState["signedIn"] as? Bool) == true else { throw VPNError.configuration("Sign in to your Firefox account first.") }
                manager = try await VPNProfile.load(create: true); try await VPNProfile.setConnected(true); await poll(); return ["ok": true]
            }
            if action == "disconnect" || action == "cancel" || (action == "logout" && usingProvider) {
                manager?.connection.stopVPNTunnel()
                if action != "logout" { await poll(); return ["ok": true] }
                for _ in 0..<100 {
                    if manager?.connection.status == .disconnected { break }
                    try await Task.sleep(nanoseconds: 100_000_000)
                }
                guard manager?.connection.status == .disconnected else { throw VPNError.configuration("Wait for the VPN to disconnect before signing out.") }
                try reloadClient()
            }
            if action == "state" { return try await requestState() }
            if usingProvider {
                if action == "login" || action == "verify" || action == "settings" || action == "select" { throw VPNError.configuration("Disconnect before changing your account or network preferences.") }
                return try await providerCall(action, args)
            }
            return try await localCall(action, args)
        } catch { return ["ok": false, "error": error.localizedDescription] }
    }
    private func requestState() async throws -> [String: Any] {
        if manager == nil { manager = try? await VPNProfile.load() }
        if manager?.connection.status == .connected { var response=try await providerCall("state", []);if var state=response["data"] as? [String:Any]{state["systemDark"]=systemDark;response["data"]=state};return response }
        var state = lastLocalState
        if usingProvider { state["connection"] = manager?.connection.status == .disconnecting ? "disconnecting" : "connecting"; state["busy"] = false }
        guard state["settings"] != nil else { throw VPNError.configuration("Secure storage could not initialize. This build needs its configured signing entitlements.") }
        return ["ok": true, "data": state]
    }
}
