// SPDX-License-Identifier: GPL-3.0-or-later
import Foundation
import NetworkExtension
import FoxCore
import WidgetKit
final class PacketTunnelProvider: NEPacketTunnelProvider {
    private let worker = DispatchQueue(label: "com.foxvpn.ios.tunnel", qos: .userInitiated)
    private let host = CoreHost()
    private var client: AppleClient?
    private let path = PathObserver()
    private var timer: DispatchSourceTimer?
    private var ready = false
    private var stopping = false
    private var lastConnected = false
    override func startTunnel(options: [String: NSObject]?, completionHandler: @escaping (Error?) -> Void) {
        worker.async {
            do {
                self.host.configureTunnel = { [weak self] raw in self?.openTunnel(raw) ?? -1 }
                self.host.onState = { [weak self] raw in self?.publish(raw) }
                let directory = try SharedStore.directory().appendingPathComponent("engine-tunnel").path
                self.client = AppleNewClient(self.host, try SharedStore.readVault(), directory)
                guard let client = self.client else { throw VPNError.configuration("The native VPN core could not initialize.") }
                self.path.start { [weak client] raw in client?.updatePath(raw) }
                let result = client.call("connect", args: "[]") ?? "{}"
                let value = try JSONSerialization.jsonObject(with: Data(result.utf8)) as? [String: Any]
                guard value?["ok"] as? Bool == true else { throw VPNError.configuration(value?["error"] as? String ?? "Connection failed.") }
                self.ready = true; self.publish(client.snapshot() ?? "{}")
                let timer = DispatchSource.makeTimerSource(queue: self.worker)
                timer.schedule(deadline: .now(), repeating: 5)
                timer.setEventHandler { [weak self] in guard let self, let state = self.client?.snapshot() else { return }; self.publish(state) }
                self.timer = timer; timer.resume(); completionHandler(nil)
            } catch { self.finish(); completionHandler(error) }
        }
    }
    private func publish(_ raw: String) {
        guard let value = try? JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any] else { return }
        let snapshot = SessionSnapshot.from(value); try? SharedStore.writeSnapshot(snapshot)
        if lastConnected != snapshot.connected { lastConnected = snapshot.connected; ControlCenter.shared.reloadControls(ofKind: SharedStore.controlKind) }
        Task { await LiveStatus.update(snapshot) }
        if ready && !stopping && value["connection"] as? String == "disconnected" {
            worker.async { [weak self] in self?.cancelTunnelWithError(VPNError.configuration(value["lastError"] as? String ?? "VPN connection interrupted.")) }
        }
    }
    private func openTunnel(_ raw: String) -> Int32 {
        do {
            let plan = try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any] ?? [:]
            let ipv4 = plan["ipv4"] as? [[String: Any]] ?? []; let ipv6 = plan["ipv6"] as? [[String: Any]] ?? []
            let configuration = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: "127.0.0.1")
            let v4 = NEIPv4Settings(addresses: ipv4.compactMap { $0["address"] as? String }, subnetMasks: ipv4.compactMap { $0["mask"] as? String })
            v4.includedRoutes = (plan["routes4"] as? [[String: Any]] ?? []).compactMap { route in guard let address = route["address"] as? String, let mask = route["mask"] as? String else { return nil }; return NEIPv4Route(destinationAddress: address, subnetMask: mask) }
            configuration.ipv4Settings = v4
            if !ipv6.isEmpty {
                let v6 = NEIPv6Settings(addresses: ipv6.compactMap { $0["address"] as? String }, networkPrefixLengths: ipv6.compactMap { $0["prefix"] as? NSNumber })
                v6.includedRoutes = (plan["routes6"] as? [[String: Any]] ?? []).compactMap { route in guard let address = route["address"] as? String, let prefix = route["prefix"] as? NSNumber else { return nil }; return NEIPv6Route(destinationAddress: address, networkPrefixLength: prefix) }; configuration.ipv6Settings = v6
            }
            configuration.mtu = plan["mtu"] as? NSNumber ?? 1500
            configuration.dnsSettings = NEDNSSettings(servers: [plan["dns"] as? String ?? "172.29.0.2"])
            configuration.dnsSettings?.matchDomains = [""]
            let gate = DispatchSemaphore(value: 0); var failed = false
            setTunnelNetworkSettings(configuration) { error in failed = error != nil; gate.signal() }
            guard gate.wait(timeout: .now() + 15) == .success, !failed, let address = ipv4.first?["address"] as? String,
                  let fd = TunnelDescriptor.find(address: address) else { return -1 }
            return fd
        } catch { return -1 }
    }
    override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        stopping = true; client?.stop()
        worker.async { self.finish(); completionHandler() }
    }
    private func finish() {
        stopping = true; ready = false; timer?.cancel(); timer = nil; path.stop(); client?.stop(); client = nil
        let snapshot = SessionSnapshot(); try? SharedStore.writeSnapshot(snapshot)
        ControlCenter.shared.reloadControls(ofKind: SharedStore.controlKind); Task { await LiveStatus.update(snapshot) }
    }
    override func handleAppMessage(_ messageData: Data, completionHandler: ((Data?) -> Void)?) {
        guard messageData.count < 65536, let request = try? JSONSerialization.jsonObject(with: messageData) as? [String: Any],
              let action = request["action"] as? String, ["state", "account", "servers", "ping", "exit", "theme", "locationSort", "clearLogs"].contains(action),
              let args = request["args"] as? [Any], let data = try? JSONSerialization.data(withJSONObject: args) else { completionHandler?(nil); return }
        let task = {
            guard let client = self.client else { completionHandler?(nil); return }
            let response = client.call(action, args: String(decoding: data, as: UTF8.self)) ?? "{}"
            completionHandler?(Data(response.utf8))
        }
        // State polling never waits behind a location or account network request.
        DispatchQueue.global(qos: action == "state" ? .userInteractive : .utility).async(execute: task)
    }
}
