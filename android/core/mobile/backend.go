// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/cookiejar"
	"strings"
	"sync"
	"syscall"
	"time"
)

// Host is implemented by the mobile platform. Credentials never cross the WebView bridge.
type Host interface {
	Save(vault string) error
	Changed(state string)
	Protect(fd int32) bool
	DNSAddress() string
	Certificates() string
}
type object = map[string]any

func str(m object, k string) string { v, _ := m[k].(string); return v }
func num(m object, k string) float64 {
	switch v := m[k].(type) {
	case float64:
		return v
	case int:
		return float64(v)
	case int64:
		return float64(v)
	}
	return 0
}
func yes(m object, k string) bool { v, _ := m[k].(bool); return v }
func obj(m object, k string) object {
	v, _ := m[k].(map[string]any)
	if v == nil {
		return object{}
	}
	return v
}
func list(m object, k string) []any {
	v, _ := m[k].([]any)
	if v == nil {
		return []any{}
	}
	return v
}
func copyObject(m object) object {
	b, _ := json.Marshal(m)
	var out object
	json.Unmarshal(b, &out)
	return out
}
func millis() int64 { return time.Now().UnixMilli() }
func defaults() object {
	return object{"theme": "system", "proxyOnly": false, "bind": "127.0.0.1", "socksPort": 1080, "doh": "automatic", "customDns": "", "edge": "", "exitCheck": true, "excludedApps": []any{}, "upstream": object{"enabled": false, "type": "socks5", "host": "", "port": 1080, "username": "", "password": ""}, "serverId": "REC"}
}

type Backend struct {
	mu                        sync.Mutex
	action                    sync.Mutex
	host                      Host
	settings, auth, pending   object
	client                    *http.Client
	dialer                    *net.Dialer
	roots                     *x509.CertPool
	servers                   []object
	logs                      []object
	latencies                 object
	connection                string
	platform                  string
	started                   int64
	exit, quota               object
	lastError                 string
	busy, pinging, systemDark bool
	pingingIDs                []string
	tunnel                    *proxyTunnel
	cancel                    context.CancelFunc
	epoch                     uint64
}

func NewBackend(host Host, vault string) *Backend {
	b := &Backend{host: host, settings: defaults(), servers: []object{}, logs: []object{}, latencies: object{}, pingingIDs: []string{}, connection: "disconnected", platform: "android", systemDark: true}
	var saved object
	if json.Unmarshal([]byte(vault), &saved) == nil {
		if s := obj(saved, "settings"); len(s) > 0 && validate(s) == nil {
			b.settings = s
		}
		b.servers = cachedServers(list(saved, "servers"))
		b.auth = obj(saved, "auth")
		if len(b.auth) == 0 {
			b.auth = nil
		}
	}
	roots, _ := x509.SystemCertPool()
	if roots == nil {
		roots = x509.NewCertPool()
	}
	if !roots.AppendCertsFromPEM([]byte(host.Certificates())) {
		b.logs = append(b.logs, object{"time": time.Now().UTC().Format(time.RFC3339), "level": "error", "message": "No CA certificates could be loaded from the device or bundle"})
	}
	b.roots = roots
	control := func(_, _ string, c syscall.RawConn) error {
		var failed bool
		err := c.Control(func(fd uintptr) { failed = !host.Protect(int32(fd)) })
		if err != nil {
			return err
		}
		if failed {
			return errors.New("Cannot protect the network socket")
		}
		return nil
	}
	resolver := &net.Resolver{PreferGo: true, Dial: func(ctx context.Context, network, _ string) (net.Conn, error) {
		ip := host.DNSAddress()
		if net.ParseIP(strings.Split(ip, "%")[0]) == nil {
			return nil, errors.New("Network DNS is unavailable")
		}
		return (&net.Dialer{Timeout: 10 * time.Second, Control: control}).DialContext(ctx, network, net.JoinHostPort(ip, "53"))
	}}
	b.dialer = &net.Dialer{Timeout: 15 * time.Second, Control: control, Resolver: resolver}
	jar, _ := cookiejar.New(nil)
	b.client = &http.Client{Timeout: 30 * time.Second, Jar: jar, Transport: &http.Transport{DialContext: b.dialer.DialContext, TLSClientConfig: &tls.Config{RootCAs: roots, MinVersion: tls.VersionTLS12}, ForceAttemptHTTP2: true}, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	return b
}
// NewAppleBackend uses Darwin's system resolver and identifies iOS snapshots.
func NewAppleBackend(host Host, vault string) *Backend {
    b := NewBackend(host, vault)
    b.platform = "ios"
    if str(b.settings,"locationSort")=="" { b.settings["locationSort"]="ping-asc" }
    b.dialer.Resolver = nil
    return b
}

func (b *Backend) snapshotLocked() object {
	s := copyObject(b.settings)
	u := obj(s, "upstream")
	u["hasPassword"] = str(u, "password") != ""
	u["password"] = ""
	var active any
	var up, down int64
	if b.tunnel != nil {
		if b.connection == "connected" {
			active = b.tunnel.server
		}
		up = b.tunnel.up.Load()
		down = b.tunnel.down.Load()
	}
	var email string
	if b.auth != nil {
		email = str(b.auth, "email")
	}
	return object{"version": "1.0.0", "platform": b.platform, "settings": s, "signedIn": b.auth != nil, "email": email, "servers": b.servers, "logs": b.logs, "latencies": b.latencies, "pinging": b.pinging, "pingingIds": b.pingingIDs, "activeServer": active, "connection": b.connection, "startedAt": b.started, "exit": b.exit, "quota": b.quota, "lastError": b.lastError, "up": up, "down": down, "busy": b.busy, "systemDark": b.systemDark}
}
func (b *Backend) Snapshot() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	data, _ := json.Marshal(b.snapshotLocked())
	return string(data)
}
func (b *Backend) emit() {
	if b.host != nil {
		b.host.Changed(b.Snapshot())
	}
}
func (b *Backend) SetDark(dark bool) { b.mu.Lock(); b.systemDark = dark; b.mu.Unlock(); b.emit() }
func (b *Backend) log(level, message string) {
	b.mu.Lock()
	b.logs = append(b.logs, object{"time": time.Now().UTC().Format(time.RFC3339), "level": level, "message": message})
	if len(b.logs) > 1000 {
		b.logs = b.logs[len(b.logs)-1000:]
	}
	b.mu.Unlock()
	b.emit()
}
func (b *Backend) save() error {
	b.mu.Lock()
	v, _ := json.Marshal(object{"settings": b.settings, "auth": b.auth, "servers": b.servers})
	b.mu.Unlock()
	return b.host.Save(string(v))
}
func (b *Backend) setAuth(auth object) error {
	b.mu.Lock()
	old := b.auth
	b.auth = auth
	b.mu.Unlock()
	if err := b.save(); err != nil {
		b.mu.Lock()
		b.auth = old
		b.mu.Unlock()
		return err
	}
	b.emit()
	return nil
}
func validate(s object) error {
	switch str(s, "theme") {
	case "dark", "light", "system":
	default:
		return errors.New("Choose a valid theme")
	}
	if str(s, "bind") != "127.0.0.1" && str(s, "bind") != "0.0.0.0" {
		return errors.New("Invalid bind address")
	}
	for _, p := range []float64{num(s, "socksPort"), num(obj(s, "upstream"), "port")} {
		if p < 1 || p > 65535 || p != float64(int(p)) {
			return errors.New("Invalid port")
		}
	}
	if ip := str(s, "customDns"); ip != "" && net.ParseIP(ip) == nil {
		return errors.New("Custom DNS must be an IP address")
	}
	switch str(s, "doh") {
	case "automatic", "cloudflare", "google", "quad9", "off":
	default:
		return errors.New("Invalid DNS provider")
	}
	for _, key := range []string{"proxyOnly", "exitCheck"} {
		if _, ok := s[key].(bool); !ok {
			return errors.New("Invalid setting")
		}
	}
	for _, p := range list(s, "excludedApps") {
		v, ok := p.(string)
		if !ok || !packageName.MatchString(v) {
			return errors.New("Choose Android package names such as com.android.chrome")
		}
	}
	if len(list(s, "excludedApps")) > 100 {
		return errors.New("Too many excluded apps")
	}
	u := obj(s, "upstream")
	if str(u, "type") != "socks5" && str(u, "type") != "http" {
		return errors.New("Invalid upstream proxy type")
	}
	for _, key := range []string{"host", "username", "password"} {
		if _, ok := u[key].(string); !ok {
			return errors.New("Invalid upstream settings")
		}
	}
	for _, host := range []string{str(s, "edge"), str(u, "host")} {
		if host != "" && net.ParseIP(host) == nil && !hostName.MatchString(host) {
			return errors.New("Invalid hostname")
		}
	}
	if yes(u, "enabled") && str(u, "host") == "" {
		return errors.New("Enter an upstream hostname")
	}
	if str(s, "serverId") == "" || len(str(s, "serverId")) > 512 {
		return errors.New("Invalid location")
	}
	return nil
}
func envelope(data any, err error) string {
	out := object{"ok": err == nil, "data": data}
	if err != nil {
		out["error"] = err.Error()
	}
	v, _ := json.Marshal(out)
	return string(v)
}
func (b *Backend) Call(channel, argsJSON string) string {
	var args []any
	if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
		return envelope(nil, errors.New("Invalid request"))
	}
	if channel == "state" {
		return "{\"ok\":true,\"data\":" + b.Snapshot() + "}"
	}
	if channel == "cancel" || channel == "disconnect" {
		b.Disconnect()
		return envelope(nil, nil)
	}
	b.action.Lock()
	defer b.action.Unlock()
	arg := func(i int) any {
		if i < len(args) {
			return args[i]
		}
		return nil
	}
	text := func(i int) string { s, _ := arg(i).(string); return s }
	var result any
	var err error
	ctx := context.Background()
	switch channel {
	case "servers":
		result, err = b.refreshServers(ctx)
	case "login":
		v, _ := arg(0).(map[string]any)
		result, err = b.login(ctx, str(v, "email"), str(v, "password"))
	case "verify":
		result, err = b.verify(ctx, text(0))
	case "logout":
		b.Disconnect()
		b.pending = nil
		err = b.setAuth(nil)
	case "account":
		result, _, err = b.guardian(ctx, "status", "GET", true)
		if err == nil {
			d, _ := result.(map[string]any)
			if yes(d, "limited_bandwidth") {
				_, headers, e := b.pass(ctx)
				if e == nil {
					d["quotaRemaining"] = headers.Get("x-quota-remaining")
				}
			}
		}
	case "settings":
		s, _ := arg(0).(map[string]any)
		b.mu.Lock()
		old := b.settings
		connected := b.connection != "disconnected"
		b.mu.Unlock()
		if connected {
			err = errors.New("Disconnect before changing settings")
			break
		}
		u := obj(s, "upstream")
		if !yes(s, "clearUpstreamPassword") && str(u, "password") == "" {
			u["password"] = str(obj(old, "upstream"), "password")
		}
		delete(s, "clearUpstreamPassword")
		if err = validate(s); err == nil {
			b.mu.Lock()
			b.settings = s
			b.mu.Unlock()
			err = b.save()
			if err != nil {
				b.mu.Lock()
				b.settings = old
				b.mu.Unlock()
			}
		}
    case "locationSort":
        mode:=text(0)
        if mode!="ping-asc"&&mode!="ping-desc"&&mode!="name-asc"&&mode!="name-desc" { err=errors.New("Invalid location order");break }
        b.mu.Lock();old:=b.settings["locationSort"];b.settings["locationSort"]=mode;b.mu.Unlock()
        err=b.save();if err!=nil {b.mu.Lock();b.settings["locationSort"]=old;b.mu.Unlock()}
    case "theme":
		theme := text(0)
		if theme != "light" && theme != "dark" && theme != "system" {
			err = errors.New("Invalid theme")
			break
		}
		b.mu.Lock()
		b.settings["theme"] = theme
		b.mu.Unlock()
		err = b.save()
	case "select":
		b.mu.Lock()
		if b.connection != "disconnected" {
			err = errors.New("Disconnect before choosing a location")
		} else {
			found := text(0) == "REC"
			for _, s := range b.servers {
				if str(s, "id") == text(0) {
					found = true
				}
			}
			if !found {
				err = errors.New("Unknown location")
			} else {
				b.settings["serverId"] = text(0)
			}
		}
		b.mu.Unlock()
		if err == nil {
			err = b.save()
		}
	case "ping":
		err = b.ping(ctx, text(0))
	case "connect":
		err = b.connect()
		result = b.EngineConfig()
	case "exit":
		b.mu.Lock()
		t := b.tunnel
		id := str(b.settings, "serverId")
		b.mu.Unlock()
		if t == nil {
			err = errors.New("Connect first")
		} else {
			expected := ""
			if id != "REC" {
				expected = str(t.server, "code")
			}
			result, err = t.exit(ctx, expected)
			if err == nil {
				b.mu.Lock()
				if b.tunnel == t {
					b.exit = result.(object)
				}
				b.mu.Unlock()
				go b.refreshAddresses(t)
			}
		}
	case "clearLogs":
		b.mu.Lock()
		b.logs = []object{}
		b.mu.Unlock()
	default:
		err = errors.New("Unknown action")
	}
	b.emit()
	return envelope(result, err)
}
func (b *Backend) connect() error {
	b.mu.Lock()
	if b.connection != "disconnected" {
		b.mu.Unlock()
		return errors.New("A connection is already active")
	}
	b.epoch++
	epoch := b.epoch
	ctx, cancel := context.WithCancel(context.Background())
	b.cancel = cancel
	b.connection = "connecting"
	b.busy = true
	b.lastError = ""
	s := copyObject(b.settings)
	b.mu.Unlock()
	b.emit()
	complete := false
	defer func() {
		b.mu.Lock()
		b.busy = false
		b.mu.Unlock()
		if !complete {
			b.Disconnect()
		}
		b.emit()
	}()
	if !yes(s, "proxyOnly") && str(s, "splitMode") == "include" && len(list(s, "excludedApps")) == 0 {
		return errors.New("No apps selected. Choose at least one app in Settings > Split tunneling before connecting.")
	}
	if b.auth == nil {
		return errors.New("Sign in to your Firefox account first")
	}
	b.mu.Lock()
	servers := append([]object{}, b.servers...)
	b.mu.Unlock()
	if len(servers) == 0 {
		var err error
		servers, err = b.refreshServers(ctx)
		if err != nil {
			return err
		}
	}
	token, headers, err := b.pass(ctx)
	if err != nil {
		return err
	}
	b.mu.Lock()
	b.quota = object{"limit": headers.Get("x-quota-limit"), "remaining": headers.Get("x-quota-remaining"), "reset": headers.Get("x-quota-reset")}
	b.mu.Unlock()
	if str(s, "serverId") == "REC" {
		for i := range servers {
			var buf [1]byte
			rand.Read(buf[:])
			j := int(buf[0]) % len(servers)
			servers[i], servers[j] = servers[j], servers[i]
		}
	}
	attempts := 0
	for _, server := range servers {
		if str(s, "serverId") != "REC" && str(s, "serverId") != str(server, "id") {
			continue
		}
		attempts++
		if attempts > 5 {
			break
		}
		t := newTunnel(b, s, server, token, ctx)
		if err = t.start(); err != nil {
			b.log("error", "Tunnel to "+locationLabel(server)+" failed: "+err.Error())
			t.close()
			continue
		}
		var exit object
		if yes(s, "exitCheck") || str(s, "serverId") == "REC" {
			expected := ""
			if str(s, "serverId") != "REC" {
				expected = str(server, "code")
			}
			exit, err = t.exit(ctx, expected)
			if err != nil {
				t.close()
				continue
			}
		}
		b.mu.Lock()
		if b.epoch != epoch {
			b.mu.Unlock()
			t.close()
			return errors.New("Connection cancelled")
		}
		b.tunnel = t
		b.exit = exit
		b.mu.Unlock()
		complete = true
		b.log("info", "HTTP/2 tunnel ready · "+locationLabel(server))
		if yes(s, "proxyOnly") {
			b.Ready()
		}
		return nil
	}
	if err == nil {
		err = errors.New("No location could be reached")
	}
	return err
}

// Ready is called only after the platform VPN engine has started.
func (b *Backend) Ready() {
	b.mu.Lock()
	if b.tunnel == nil || b.connection != "connecting" {
		b.mu.Unlock()
		return
	}
	t := b.tunnel
	b.connection = "connected"
	b.started = millis()
	b.mu.Unlock()
	b.log("info", "Connected · Fox VPN is active")
	go b.renew(t)
	go t.monitor()
	go b.refreshAddresses(t)
}
func (b *Backend) renew(t *proxyTunnel) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-t.ctx.Done():
			return
		case <-ticker.C:
		}
		b.mu.Lock()
		active := b.connection == "connected" && b.tunnel == t
		b.mu.Unlock()
		if !active || t == nil {
			return
		}
		if t.expiry.Load() > time.Now().Unix()+120 {
			continue
		}
		b.action.Lock()
		token, _, err := b.pass(t.ctx)
		if err == nil {
			t.setToken(token)
		}
		b.action.Unlock()
		if err != nil {
			b.failTunnel(t, "Proxy pass renewal failed. Reconnect after checking your account.")
			return
		}
		b.log("info", "Proxy pass renewed")
	}
}
func (b *Backend) Failed(message string) {
	b.stop(nil, message)
}
func (b *Backend) Disconnect() {
	b.stop(nil, "")
}
func (b *Backend) failTunnel(t *proxyTunnel, message string) {
	b.stop(t, message)
}
func (b *Backend) stop(expected *proxyTunnel, message string) {
	b.mu.Lock()
	if expected != nil && b.tunnel != expected {
		b.mu.Unlock()
		return
	}
	if message != "" {
		b.lastError = message
	}
	b.epoch++
	cancel := b.cancel
	b.cancel = nil
	t := b.tunnel
	b.tunnel = nil
	b.connection = "disconnected"
	b.started = 0
	b.exit = nil
	b.busy = false
	b.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	if t != nil {
		t.close()
		b.log("info", "Disconnected · Device routes restored")
	}
	if message != "" {
		b.log("error", message)
	}
	b.emit()
}
func (b *Backend) EngineConfig() string {
	b.mu.Lock()
	s := copyObject(b.settings)
	b.mu.Unlock()
	providers := map[string]string{"cloudflare": "cloudflare-dns.com", "google": "dns.google", "quad9": "dns.quad9.net"}
	dns := object{"tag": "private", "type": "https", "server": providers[str(s, "doh")], "path": "/dns-query", "detour": "fox"}
	if str(s, "doh") == "automatic" {
		dns = object{"tag": "private", "type": "udp", "server": "1.1.1.1", "detour": "fox"}
	}
	if str(s, "customDns") != "" {
		dns = object{"tag": "private", "type": "tcp", "server": str(s, "customDns"), "detour": "fox"}
	} else if str(s, "doh") == "off" {
		dns = object{"tag": "private", "type": "udp", "server": b.host.DNSAddress(), "detour": "direct"}
	}
	c := object{"log": object{"level": "warn"}, "dns": object{"servers": []any{dns}, "final": "private", "strategy": "prefer_ipv4"}, "inbounds": []any{object{"type": "tun", "tag": "tun", "address": []string{"172.29.0.1/30", "fdfe:dcba:9876::1/126"}, "mtu": 1500, "auto_route": true, "stack": "mixed", "exclude_package": s["excludedApps"]}}, "outbounds": []any{object{"type": "socks", "tag": "fox", "server": "127.0.0.1", "server_port": s["socksPort"], "version": "5"}, object{"type": "direct", "tag": "direct"}}, "route": object{"auto_detect_interface": true, "final": "fox", "rules": []any{object{"action": "sniff"}, object{"protocol": "dns", "action": "hijack-dns"}, object{"ip_is_private": true, "action": "route", "outbound": "direct"}, object{"network": "udp", "action": "reject"}}}}
	v, _ := json.Marshal(c)
	return string(v)
}
func (b *Backend) ping(ctx context.Context, id string) error {
	token, _, passErr := b.pass(ctx)
	if passErr != nil { return passErr }
	b.mu.Lock()
	settings := copyObject(b.settings)
	servers := append([]object{}, b.servers...)
	if id == "" {
		b.pinging = true
	} else {
		b.pingingIDs = []string{id}
	}
	b.mu.Unlock()
	b.emit()
	defer func() { b.mu.Lock(); b.pinging = false; b.pingingIDs = []string{}; b.mu.Unlock(); b.emit() }()
	if len(servers) == 0 {
		var err error
		servers, err = b.refreshServers(ctx)
		if err != nil {
			return err
		}
	}
	found := id == ""
	var wg sync.WaitGroup
	limit := make(chan struct{}, 3)
	for _, s := range servers {
		if id != "" && str(s, "id") != id {
			continue
		}
		found = true
		wg.Add(1)
		go func(server object) {
			defer wg.Done()
			limit <- struct{}{}
			defer func() { <-limit }()
			pctx, cancel := context.WithTimeout(ctx, 5*time.Second)
			defer cancel()
			probe := newTunnel(b, settings, server, token, pctx)
            defer probe.close()
            delay, err := probe.realDelay(pctx, "https://www.google.com/generate_204")
			var latency any
			if err == nil {
				latency = delay
				if latency.(int64) < 1 {
					latency = int64(1)
				}
			}
			b.mu.Lock()
			b.latencies[str(server, "id")] = object{"ms": latency, "measuredAt": millis(), "kind": "real-delay"}
			b.mu.Unlock()
			b.emit()
		}(s)
	}
	wg.Wait()
	if !found {
		return errors.New("Unknown location")
	}
	return nil
}
func (b *Backend) LogExport() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	var out strings.Builder
	for _, l := range b.logs {
		fmt.Fprintf(&out, "%s [%s] %s\n", str(l, "time"), str(l, "level"), str(l, "message"))
	}
	return out.String()
}

// Address-family discovery is optional and never gates or tears down a VPN.
func (b *Backend) refreshAddresses(t *proxyTunnel) {
	b.mu.Lock()
	if b.tunnel != t || b.connection != "connected" {
		b.mu.Unlock()
		return
	}
	base := copyObject(b.exit)
	if base == nil {
		base = object{}
	}
	pending := copyObject(base)
	pending["pending"] = true
	b.exit = pending
	b.mu.Unlock()
	b.emit()
	ctx, cancel := context.WithTimeout(t.ctx, 8*time.Second)
	defer cancel()
	if str(base, "ip") == "" {
		value, err := t.exit(ctx, "")
		if err == nil {
			base = value
		}
	}
	if str(base, "ip") != "" {
		base = t.addresses(ctx, base)
	}
	base["pending"] = false
	b.mu.Lock()
	if b.tunnel == t && b.connection == "connected" {
		b.exit = base
	}
	b.mu.Unlock()
	b.emit()
}

// Cached locations contain public endpoint metadata only; credentials remain separate.
func cachedServers(values []any) []object {
 result := []object{}
 if len(values)>2000 { return result }
 for _,value:=range values {
  server,ok:=value.(map[string]any)
  if !ok { continue }
  host:=str(server,"host");port:=num(server,"port")
  if str(server,"id")=="" || len(str(server,"id"))>512 || str(server,"country")=="" || len(str(server,"code"))<2 || len(str(server,"code"))>3 || len(host)>253 || (net.ParseIP(host)==nil && !cachedHost.MatchString(host)) || port<1 || port>65535 || port!=float64(int(port)) { continue }
  result=append(result,object{"id":str(server,"id"),"country":str(server,"country"),"code":str(server,"code"),"city":displayCity(str(server,"country"),str(server,"city")),"cityCode":str(server,"cityCode"),"host":host,"port":port})
 }
 return result
}
