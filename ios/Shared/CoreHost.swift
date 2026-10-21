// SPDX-License-Identifier: GPL-3.0-or-later
import Foundation
import FoxCore
import Network
import Darwin
class CoreHost: NSObject, AppleHostProtocol {
    var onState: ((String) -> Void)?
    var configureTunnel: ((String) -> Int32)?
    func saveVault(_ vault: String?) -> Bool { do { try SharedStore.writeVault(vault ?? "{}"); return true } catch { return false } }
    func changed(_ state: String?) { if let state { onState?(state) } }
    func certificates() -> String { guard let url = Bundle.main.url(forResource: "cacert", withExtension: "pem") else { return "" }; return (try? String(contentsOf: url, encoding: .utf8)) ?? "" }
    func dnsAddress() -> String { "1.1.1.1" }
    func openTun(_ plan: String?) -> Int32 { guard let plan, let configureTunnel else { return -1 }; return configureTunnel(plan) }
}
final class PathObserver {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.foxvpn.ios.network")
    func start(_ handler: @escaping (String) -> Void) {
        monitor.pathUpdateHandler = { path in
            let selected = path.availableInterfaces.first(where: { path.usesInterfaceType($0.type) })
            let value: [String: Any] = ["name": selected?.name ?? "", "index": selected?.index ?? 0, "expensive": path.isExpensive, "constrained": path.isConstrained]
            if let data = try? JSONSerialization.data(withJSONObject: value), let text = String(data: data, encoding: .utf8) { handler(text) }
        }; monitor.start(queue: queue)
    }
    func stop() { monitor.cancel() }
}
