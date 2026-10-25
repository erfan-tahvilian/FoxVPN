// SPDX-License-Identifier: GPL-3.0-or-later
package mobile
import("context";"encoding/json";"errors";"io";"net/http";"strings";"testing")
func fixtureAuth(email,token string)object{return object{"email":email,"access_token":token,"refresh_token":"refresh-"+token,"expiresAt":millis()+3600000}}
func TestSavedAccountsMigrationIsolationAndRollback(t *testing.T){
 host:=&testHost{};legacy,_:=json.Marshal(object{"auth":fixtureAuth("one@example.com","secret-one"),"settings":defaults()});b:=NewBackend(host,string(legacy));first:=b.activeAccountID
 if len(b.accounts)!=1{t.Fatal("legacy account not migrated")};if err:=b.addAccount(fixtureAuth("two@example.com","secret-two"));err!=nil{t.Fatal(err)};second:=str(b.accounts[1],"id")
 if b.activeAccountID!=first{t.Fatal("adding account interrupted active account")}
 for id,want:=range map[string]string{first:"secret-one",second:"secret-two"}{token,err:=b.token(context.WithValue(context.Background(),accountContextKey{},id),false);if err!=nil||token!=want{t.Fatal("cross-account token",err)}}
 if strings.Contains(b.Snapshot(),"secret-")||strings.Contains(b.Snapshot(),"refresh-"){t.Fatal("credential reached renderer")}
 if err:=b.useAccount(second);err!=nil{t.Fatal(err)};restored:=NewBackend(&testHost{},host.saved);if restored.activeAccountID!=second||len(restored.accounts)!=2{t.Fatal("accounts did not persist")}
 host.fail=true;if err:=b.commitProfileAuth(second,fixtureAuth("two@example.com","replacement"));err==nil{t.Fatal("ignored encryption failure")};if str(b.auth,"access_token")!="secret-two"{t.Fatal("failed save changed active token")}
}
func TestAccountFallbackRequiresConfirmedEmptyQuota(t *testing.T){
 for _,networkFailure:=range []bool{false,true}{b:=NewBackend(&testHost{},"{}");b.addAccount(fixtureAuth("one@example.com","one"));b.addAccount(fixtureAuth("two@example.com","two"));first:=b.activeAccountID;second:=str(b.accounts[1],"id");calls:=0
 b.client=&http.Client{Transport:exitRoundTripper(func(r *http.Request)(*http.Response,error){calls++;if networkFailure{return nil,errors.New("offline")};h:=http.Header{"X-Quota-Limit":[]string{"100"},"X-Quota-Remaining":[]string{"0"}};if r.Header.Get("Authorization")=="Bearer two"{h.Set("X-Quota-Remaining","50")};return &http.Response{StatusCode:200,Header:h,Body:io.NopCloser(strings.NewReader(`{"token":"proxy-pass"}`))},nil})}
 token,_,err:=b.prepareAccount(context.Background(),"");if networkFailure{if err==nil||calls!=1||b.activeAccountID!=first{t.Fatal("network failure switched account")}}else if err!=nil||token!="proxy-pass"||calls!=2||b.activeAccountID!=second{t.Fatalf("quota fallback failed %v calls=%d",err,calls)}
 }
}
func TestTrafficRetainedAfterDisconnectAndRestart(t *testing.T){
 host:=&testHost{};b:=NewBackend(host,"{}");tunnel:=newTunnel(b,defaults(),object{},"fixture",context.Background());b.tunnel=tunnel;b.connection="connected";b.started=millis()-1000;tunnel.up.Store(20);tunnel.down.Store(70);b.Snapshot();b.Snapshot();b.Disconnect()
 restored:=NewBackend(&testHost{},host.saved);if num(restored.totalTraffic,"totalUp")!=20||num(restored.totalTraffic,"totalDown")!=70||num(restored.sessionTraffic,"down")!=70||num(restored.sessionTraffic,"duration")<1000{t.Fatal("traffic lost or counted more than once")}
}

func TestStaleAccountRejectionDoesNotAffectReplacement(t *testing.T){
 b:=NewBackend(&testHost{},"{}");b.addAccount(fixtureAuth("one@example.com","one"));old:=b.activeAccountID;b.addAccount(fixtureAuth("two@example.com","two"));next:=str(b.accounts[1],"id");b.useAccount(next)
 tunnel:=newTunnel(b,defaults(),object{},"fixture",context.Background());defer tunnel.close();b.tunnel=tunnel;b.connection="connected"
 b.rejectedAccount(tunnel,429,http.Header{"X-Quota-Remaining":[]string{"0"}},old)
 if b.connection!="connected"||b.activeAccountID!=next{t.Fatal("stale rejection interrupted replacement account")}
}
