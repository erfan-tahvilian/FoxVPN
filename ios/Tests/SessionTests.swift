// SPDX-License-Identifier: GPL-3.0-or-later
import XCTest
import FoxCore
@testable import FoxVPN
final class SessionTests:XCTestCase {
    func testTrafficFormattingAndLocationIdentity(){
        XCTAssertEqual(SessionSnapshot.bytes(1048576),"1.0 MB")
        XCTAssertEqual(SessionSnapshot.bytes(-1),"0 B")
        let state:[String:Any] = ["connection":"connected","activeServer":["country":"Germany","city":" germany ","code":"DE"],"startedAt":1000,"down":2048,"up":1024]
        let value=SessionSnapshot.from(state)
        XCTAssertEqual(value.location,"Germany");XCTAssertEqual(value.downloaded,2048);XCTAssertEqual(value.startedAt.timeIntervalSince1970,1)
    }
    func testNativeCoreAndPersistedSorting()throws{
        let host=FixtureHost();let dir=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).path
        guard let client=AppleNewClient(host,"{}",dir)else{XCTFail("Core initialization failed");return}
        let first=try JSONSerialization.jsonObject(with:Data((client.snapshot() ?? "{}").utf8))as? [String:Any]
        XCTAssertEqual(first?["platform"]as? String,"ios")
        let response=try JSONSerialization.jsonObject(with:Data((client.call("locationSort",args:"[\"name-desc\"]") ?? "{}").utf8))as? [String:Any]
        XCTAssertEqual(response?["ok"]as? Bool,true)
        let next=AppleNewClient(host,host.vault,dir)
        XCTAssertTrue((next?.snapshot() ?? "").contains("name-desc"))
        XCTAssertFalse((next?.snapshot() ?? "").contains("access_token"))
        next?.stop();client.stop()
    }
}
private final class FixtureHost:NSObject,AppleHostProtocol {
    var vault="{}"
    func saveVault(_ text:String?)->Bool{vault=text ?? "{}";return true}
    func changed(_ value:String?){}
    func certificates()->String{(try?String(contentsOf:Bundle.main.url(forResource:"cacert",withExtension:"pem")!,encoding:.utf8)) ?? ""}
    func dnsAddress()->String{"1.1.1.1"}
    func openTun(_ plan:String?)->Int32{-1}
}
