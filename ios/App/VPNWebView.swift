// SPDX-License-Identifier: GPL-3.0-or-later
import SwiftUI
import WebKit
import UniformTypeIdentifiers
struct VPNWebView: UIViewControllerRepresentable {
    let service: AppService
    func makeUIViewController(context: Context) -> WebController { WebController(service: service) }
    func updateUIViewController(_ controller: WebController, context: Context) {}
}
final class AssetLoader: NSObject, WKURLSchemeHandler {
    let root = Bundle.main.resourceURL!.appendingPathComponent("Web").standardizedFileURL
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url, url.scheme == "foxvpn", url.host == "app" else { urlSchemeTask.didFailWithError(URLError(.badURL)); return }
        let file = root.appendingPathComponent(url.path).standardizedFileURL.resolvingSymlinksInPath()
        guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else { urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist)); return }
        let types = ["html":"text/html", "js":"application/javascript", "css":"text/css", "svg":"image/svg+xml", "png":"image/png", "webp":"image/webp", "txt":"text/plain"]
        let response = URLResponse(url: url, mimeType: types[file.pathExtension] ?? "application/octet-stream", expectedContentLength: data.count, textEncodingName: "utf-8")
        urlSchemeTask.didReceive(response); urlSchemeTask.didReceive(data); urlSchemeTask.didFinish()
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}
@MainActor final class WebController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    let service: AppService
    private var web: WKWebView!
    init(service: AppService) { self.service = service; super.init(nibName: nil, bundle: nil) }
    required init?(coder: NSCoder) { fatalError("Unsupported initializer") }
    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = .systemBackground
        let configuration = WKWebViewConfiguration(); configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.setURLSchemeHandler(AssetLoader(), forURLScheme: "foxvpn")
        configuration.userContentController.add(self, name: "fox")
        web = WKWebView(frame: .zero, configuration: configuration); web.navigationDelegate = self; web.isOpaque = false; web.backgroundColor = view.backgroundColor
        web.scrollView.showsVerticalScrollIndicator = false; web.scrollView.showsHorizontalScrollIndicator = false
        web.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(web)
        NSLayoutConstraint.activate([web.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor),web.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor),web.leadingAnchor.constraint(equalTo:view.leadingAnchor),web.trailingAnchor.constraint(equalTo:view.trailingAnchor)])
        service.web = web; web.load(URLRequest(url: URL(string:"foxvpn://app/src/ui/index.html")!))
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(navigationAction.targetFrame?.isMainFrame == true && navigationAction.request.url?.absoluteString == "foxvpn://app/src/ui/index.html" ? .allow : .cancel)
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { Task { await service.poll() } }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.webView === web, message.frameInfo.isMainFrame, message.frameInfo.request.url?.scheme == "foxvpn", message.frameInfo.request.url?.host == "app",
              let body = message.body as? [String: Any], let id = body["id"] as? String, id.count <= 16, !id.isEmpty, id.allSatisfy(\.isNumber),
              let action = body["action"] as? String, let args = body["args"] as? [Any] else { return }
        Task {
            let response = await service.request(action, args: args, controller: self)
            guard let data = try? JSONSerialization.data(withJSONObject: response), let raw = String(data:data,encoding:.utf8),
                  let idData = try? JSONSerialization.data(withJSONObject: id, options: .fragmentsAllowed), let idJSON = String(data:idData,encoding:.utf8) else { return }
            web.evaluateJavaScript("window.fox.resolve(\(idJSON),\(raw))", completionHandler:nil)
        }
    }
}
