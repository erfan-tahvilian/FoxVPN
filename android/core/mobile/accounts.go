// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type accountContextKey struct{}

func (b *Backend) accountID(ctx context.Context) string {
	if id, _ := ctx.Value(accountContextKey{}).(string); id != "" {
		return id
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.activeAccountID
}
func (b *Backend) profileLocked(id string) object {
	for _, a := range b.accounts {
		if str(a, "id") == id {
			return a
		}
	}
	return nil
}
func (b *Backend) restoreAccounts(saved object) {
	b.accounts = []object{}
	b.accountPreferences = object{"autoSwitch": true}
	b.totalTraffic = object{"totalUp": 0, "totalDown": 0, "since": millis()}
	b.sessionTraffic = object{"up": 0, "down": 0, "duration": 0}
	for _, raw := range list(saved, "accounts") {
		a, ok := raw.(map[string]any)
		if ok && str(a, "id") != "" && str(a, "email") != "" && len(b.accounts) < 20 {
			b.accounts = append(b.accounts, a)
		}
	}
	if len(b.accounts) == 0 && b.auth != nil {
		var id [16]byte
		rand.Read(id[:])
		b.accounts = append(b.accounts, object{"id": hex.EncodeToString(id[:]), "email": str(b.auth, "email"), "auth": b.auth, "status": "ready"})
	}
	b.activeAccountID = str(saved, "activeAccountId")
	if b.profileLocked(b.activeAccountID) == nil && len(b.accounts) > 0 {
		b.activeAccountID = str(b.accounts[0], "id")
	}
	if a := b.profileLocked(b.activeAccountID); a != nil {
		b.auth = obj(a, "auth")
		if len(b.auth) == 0 {
			b.auth = nil
		}
		b.quota = obj(a, "quota")
	}
	if p := obj(saved, "accountPreferences"); p["autoSwitch"] == false {
		b.accountPreferences["autoSwitch"] = false
	}
	if t := obj(saved, "totalTraffic"); num(t, "since") > 0 && num(t, "totalUp") >= 0 && num(t, "totalDown") >= 0 {
		b.totalTraffic = t
	}
	if t := obj(saved, "sessionTraffic"); num(t, "up") >= 0 && num(t, "down") >= 0 && num(t, "duration") >= 0 {
		for _, key := range []string{"up", "down", "duration"} {
			if t[key] != nil {
				b.sessionTraffic[key] = t[key]
			}
		}
	}
}
func (b *Backend) publicAccountsLocked() []object {
	out := []object{}
	for _, a := range b.accounts {
		out = append(out, object{"id": a["id"], "email": a["email"], "active": str(a, "id") == b.activeAccountID, "status": a["status"], "quota": copyObject(obj(a, "quota")), "checkedAt": a["checkedAt"]})
	}
	return out
}
func (b *Backend) commitProfileAuth(id string, auth object) error {
	b.mu.Lock()
	a := b.profileLocked(id)
	if a == nil {
		b.mu.Unlock()
		return errors.New("Account was removed")
	}
	old := copyObject(a)
	a["auth"] = auth
	a["status"] = "ready"
	if auth == nil {
		a["status"] = "sign-in-required"
	}
	if id == b.activeAccountID {
		b.auth = auth
	}
	b.mu.Unlock()
	if err := b.save(); err != nil {
		b.mu.Lock()
		for k := range a {
			delete(a, k)
		}
		for k, v := range old {
			a[k] = v
		}
		if id == b.activeAccountID {
			b.auth = obj(old, "auth")
		}
		b.mu.Unlock()
		return err
	}
	return nil
}
func (b *Backend) addAccount(auth object) error {
	if auth == nil {
		return b.removeAccount(b.activeAccountID)
	}
	b.mu.Lock()
	oldID := b.activeAccountID
	oldAuth := b.auth
	old := append([]object{}, b.accounts...)
	var a object
	for _, entry := range b.accounts {
		if strings.EqualFold(str(entry, "email"), str(auth, "email")) {
			a = entry
			break
		}
	}
	if a == nil {
		if len(b.accounts) >= 20 {
			b.mu.Unlock()
			return errors.New("Up to 20 accounts can be saved")
		}
		var id [16]byte
		rand.Read(id[:])
		a = object{"id": hex.EncodeToString(id[:]), "email": str(auth, "email")}
		b.accounts = append(b.accounts, a)
	} else {
		a = copyObject(a)
		for i, v := range b.accounts {
			if str(v, "id") == str(a, "id") {
				b.accounts[i] = a
			}
		}
	}
	a["auth"] = auth
	a["status"] = "ready"
	if b.auth == nil {
		b.activeAccountID = str(a, "id")
		b.auth = auth
	}
	if str(a, "id") == b.activeAccountID {
		b.auth = auth
	}
	b.mu.Unlock()
	if err := b.save(); err != nil {
		b.mu.Lock()
		b.accounts = old
		b.activeAccountID = oldID
		b.auth = oldAuth
		b.mu.Unlock()
		return err
	}
	b.emit()
	return nil
}
func (b *Backend) removeAccount(id string) error {
	b.mu.Lock()
	if id == b.activeAccountID && b.connection != "disconnected" {
		b.mu.Unlock()
		return errors.New("Disconnect before removing the active account")
	}
	old := append([]object{}, b.accounts...)
	oldID, oldAuth, oldQuota := b.activeAccountID, b.auth, b.quota
	next := []object{}
	for _, a := range b.accounts {
		if str(a, "id") != id {
			next = append(next, a)
		}
	}
	b.accounts = next
	if id == b.activeAccountID {
		b.activeAccountID = ""
		b.auth = nil
		b.quota = nil
		for _, a := range next {
			if len(obj(a, "auth")) > 0 {
				b.activeAccountID = str(a, "id")
				b.auth = obj(a, "auth")
				b.quota = obj(a, "quota")
				break
			}
		}
	}
	b.mu.Unlock()
	if err := b.save(); err != nil {
		b.mu.Lock()
		b.accounts = old
		b.activeAccountID = oldID
		b.auth = oldAuth
		b.quota = oldQuota
		b.mu.Unlock()
		return err
	}
	return nil
}
func quotaHeaders(h http.Header) object {
	return object{"limit": h.Get("x-quota-limit"), "remaining": h.Get("x-quota-remaining"), "reset": h.Get("x-quota-reset")}
}
func quotaEmpty(q object) bool {
	v := str(q, "remaining")
	if v == "" || yes(q, "unlimited") {
		return false
	}
	n, err := strconv.ParseFloat(v, 64)
	return err == nil && n <= 0
}
func (b *Backend) recordQuota(id string, q object) {
	b.mu.Lock()
	if a := b.profileLocked(id); a != nil {
		a["quota"] = q
		a["checkedAt"] = millis()
		a["status"] = "ready"
		if quotaEmpty(q) {
			a["status"] = "exhausted"
		}
		if id == b.activeAccountID {
			b.quota = q
		}
	}
	b.mu.Unlock()
}
func (b *Backend) useAccount(id string) error {
	b.mu.Lock()
	a := b.profileLocked(id)
	if a == nil || len(obj(a, "auth")) == 0 {
		b.mu.Unlock()
		return errors.New("Sign in to this account again")
	}
	oldID, oldAuth, oldQuota := b.activeAccountID, b.auth, b.quota
	b.activeAccountID = id
	b.auth = obj(a, "auth")
	b.quota = obj(a, "quota")
	b.mu.Unlock()
	if err := b.save(); err != nil {
		b.mu.Lock()
		b.activeAccountID = oldID
		b.auth = oldAuth
		b.quota = oldQuota
		b.mu.Unlock()
		return err
	}
	return nil
}
func (b *Backend) prepareAccount(ctx context.Context, exclude string) (string, http.Header, error) {
	b.mu.Lock()
	id := b.activeAccountID
	auto := yes(b.accountPreferences, "autoSwitch")
	ids := []string{id}
	for _, a := range b.accounts {
		if str(a, "id") != id && len(obj(a, "auth")) > 0 && auto {
			ids = append(ids, str(a, "id"))
		}
	}
	b.mu.Unlock()
	var last error
	for _, candidate := range ids {
		if candidate == "" || candidate == exclude {
			continue
		}
		token, h, err := b.pass(context.WithValue(ctx, accountContextKey{}, candidate))
		q := quotaHeaders(h)
		if err != nil && !quotaEmpty(q) {
			return "", nil, err
		} // Transport/rate-limit failures never establish quota exhaustion.
		b.recordQuota(candidate, q)
		if quotaEmpty(q) {
			last = errors.New("No data remaining on this account")
			continue
		}
		if err = b.useAccount(candidate); err != nil {
			return "", nil, err
		}
		return token, h, nil
	}
	if last == nil {
		last = errors.New("No signed-in account has an available data allowance")
	}
	return "", nil, last
}

// Keep the platform TUN and local SOCKS listener alive while replacing outbound
// streams. Every new request uses the selected account's fresh proxy pass.
func (b *Backend) selectAccount(ctx context.Context, id string) error {
	b.mu.Lock()
	t := b.tunnel
	connected := b.connection == "connected"
	epoch := b.epoch
	b.mu.Unlock()
	if !connected {
		return b.useAccount(id)
	}
	token, h, err := b.pass(context.WithValue(ctx, accountContextKey{}, id))
	if err != nil {
		return err
	}
	q := quotaHeaders(h)
	b.recordQuota(id, q)
	if quotaEmpty(q) {
		return errors.New("This account has no data remaining")
	}
	if ctx.Err() != nil {
		return ctx.Err()
	}
	b.mu.Lock()
	active := b.epoch == epoch && b.tunnel == t
	b.mu.Unlock()
	if !active {
		return errors.New("Connection cancelled")
	}
	if err = b.useAccount(id); err != nil {
		return err
	}
	t.replaceAccount(id, token)
	expected := ""
	if str(t.settings, "serverId") != "REC" {
		expected = str(t.server, "code")
	}
	exit, err := t.exit(t.ctx, expected)
	if err != nil {
		b.failTunnel(t, "Account switched but the new connection could not be verified. Reconnect to continue.")
		return err
	}
	b.mu.Lock()
	if b.tunnel == t {
		b.exit = exit
	}
	b.mu.Unlock()
	b.log("info", "Connected with the selected Firefox account")
	return nil
}
func (b *Backend) rejectedAccount(t *proxyTunnel, status int, h http.Header, eventID string) {
	b.action.Lock()
	defer b.action.Unlock()
	b.mu.Lock()
	active := b.tunnel == t && b.connection == "connected"
	id := b.activeAccountID
	auto := yes(b.accountPreferences, "autoSwitch")
	epoch := b.epoch
	b.mu.Unlock()
	if !active || id != eventID {
		return
	}
	q := quotaHeaders(h)
	if !quotaEmpty(q) {
		_, headers, err := b.pass(context.WithValue(t.ctx, accountContextKey{}, id))
		q = quotaHeaders(headers)
		if err != nil && !quotaEmpty(q) {
			b.failTunnel(t, "The proxy pass was rejected. Check your account and reconnect.")
			return
		}
	}
	if !quotaEmpty(q) || !auto {
		b.failTunnel(t, "The proxy pass was rejected or the account allowance was exhausted.")
		return
	}
	b.recordQuota(id, q)
	b.mu.Lock()
	active = b.tunnel == t && b.epoch == epoch
	b.mu.Unlock()
	if !active {
		return
	}
	token, _, err := b.prepareAccount(t.ctx, id)
	if err != nil {
		b.failTunnel(t, err.Error())
		return
	}
	if t.ctx.Err() != nil {
		return
	}
	b.mu.Lock()
	nextID := b.activeAccountID
	b.mu.Unlock()
	t.replaceAccount(nextID, token)
	expected := ""
	if str(t.settings, "serverId") != "REC" {
		expected = str(t.server, "code")
	}
	exit, err := t.exit(t.ctx, expected)
	if err != nil {
		b.failTunnel(t, "The backup account connection could not be verified")
		return
	}
	b.mu.Lock()
	if b.tunnel == t {
		b.exit = exit
	}
	b.mu.Unlock()
	b.log("info", "Data allowance exhausted. Switched to another saved account.")
}
func (t *proxyTunnel) replaceAccount(id, token string) {
	t.automaticMu.Lock()
	t.sessionMu.Lock()
	t.mu.Lock()
	sockets := make([]interface{ Close() error }, 0, len(t.sockets))
	for s := range t.sockets {
		sockets = append(sockets, s)
	}
	selected := t.selected
	t.selected = nil
	t.h3fallback = false
	h3 := t.h3
	t.h3 = nil
	t.current = nil
	t.currentSocket = nil
	t.mu.Unlock()
	if selected != nil {
		selected.close()
	}
	if h3 != nil {
		h3.close()
	}
	for _, s := range sockets {
		s.Close()
	}
	t.setToken(token)
	t.mu.Lock()
	t.accountID = id
	t.mu.Unlock()
	t.sessionMu.Unlock()
	t.automaticMu.Unlock()
}
func (b *Backend) observeTrafficLocked() {
	if b.tunnel == nil || b.started == 0 {
		return
	}
	up, down := b.tunnel.up.Load(), b.tunnel.down.Load()
	du, dd := up-b.lastUp, down-b.lastDown
	if du < 0 {
		du = 0
	}
	if dd < 0 {
		dd = 0
	}
	b.totalTraffic["totalUp"] = int64(num(b.totalTraffic, "totalUp")) + du
	b.totalTraffic["totalDown"] = int64(num(b.totalTraffic, "totalDown")) + dd
	b.sessionTraffic["up"] = up
	b.sessionTraffic["down"] = down
	b.sessionTraffic["duration"] = millis() - b.started
	b.lastUp = up
	b.lastDown = down
}
func (b *Backend) checkpointTraffic(t *proxyTunnel) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-t.ctx.Done():
			return
		case <-ticker.C:
			b.mu.Lock()
			b.observeTrafficLocked()
			b.mu.Unlock()
			if err := b.save(); err != nil {
				b.log("error", "Could not save traffic totals")
				return
			}
		}
	}
}
