// SPDX-License-Identifier: GPL-3.0-or-later
import XCTest
final class InterfaceTests:XCTestCase {
    func testPackagedInterfaceLoads(){
        let app=XCUIApplication();app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout:30))
        XCTAssertTrue(app.buttons.matching(NSPredicate(format:"label CONTAINS 'Locations'")).firstMatch.waitForExistence(timeout:30))
        app.buttons.matching(NSPredicate(format:"label CONTAINS 'Locations'")).firstMatch.tap()
        XCTAssertTrue(app.searchFields["Search locations"].waitForExistence(timeout:10))
    }
}
