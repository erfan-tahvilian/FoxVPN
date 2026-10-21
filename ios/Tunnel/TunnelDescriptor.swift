// SPDX-License-Identifier: GPL-3.0-or-later
import Foundation
import Darwin
// Use public socket/interface APIs; never access packetFlow through private KVC.
enum TunnelDescriptor {
    static func find(address: String) -> Int32? {
        var first: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&first) == 0 else { return nil }; defer { freeifaddrs(first) }
        var expected: Set<String> = []; var cursor = first
        while let item = cursor {
            defer { cursor = item.pointee.ifa_next }
            guard let socket = item.pointee.ifa_addr, socket.pointee.sa_family == UInt8(AF_INET) else { continue }
            var buffer = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            if getnameinfo(socket, socklen_t(socket.pointee.sa_len), &buffer, socklen_t(buffer.count), nil, 0, NI_NUMERICHOST) == 0, String(cString: buffer) == address {
                expected.insert(String(cString: item.pointee.ifa_name))
            }
        }
        for fd in Int32(0)..<Int32(1024) {
            var name = [CChar](repeating: 0, count: Int(IFNAMSIZ)); var length = socklen_t(name.count)
            if getsockopt(fd, 2 /* SYSPROTO_CONTROL */, 2 /* UTUN_OPT_IFNAME */, &name, &length) == 0, expected.contains(String(cString: name)) { return fd }
        }
        return nil
    }
}
