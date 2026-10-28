// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import (
 "context"
 "io"
 "net/http"
 "net/url"
 "strings"
 "testing"
)

func TestChallengeJSONArguments(t *testing.T) {
 script := `init([],"old","/_fs-ch-test"); init ( [{"ty":"clientmetrics","data":{"items":[[1,2]],"text":"brackets ] and escaped \" quotes"}}], "token", "/_fs-ch-test", true);`
 tasks, token, err := parseChallengeInit(script,"/_fs-ch-test")
 if err!=nil || len(tasks)!=1 || token!="token" { t.Fatalf("nested challenge rejected: %v",err) }
 for _, invalid := range []string{`init([],"t","/_fs-ch-test")`, `init([{"ty":"pow"}],"t","/other")`, `init([runUntrustedCode()],"t","/_fs-ch-test")`, `init([{"ty":"pow"}],"t","/_fs-ch-test" + runUntrustedCode())`} {
  if _,_,err:=parseChallengeInit(invalid,"/_fs-ch-test");err==nil { t.Fatal("invalid challenge accepted") }
 }
}

func TestAccountChallengeKeepsUserAgentAndFreshCookies(t *testing.T) {
 b := NewBackend(&testHost{},"{}")
 site,_:=url.Parse("https://accounts.firefox.com/")
 b.client.Jar.SetCookies(site,[]*http.Cookie{{Name:"stale",Value:"clearance",Path:"/"}})
 var agents []string
 b.client.Transport = exitRoundTripper(func(r *http.Request)(*http.Response,error){
  agents=append(agents,r.UserAgent())
  if _,err:=r.Cookie("stale");err==nil { t.Fatal("Stale challenge cookies reached the fresh solver") }
  response:=&http.Response{StatusCode:200,Header:make(http.Header),Request:r}
  body:="{}"
  switch {
  case r.URL.Hostname()=="api.accounts.firefox.com":
   if r.Method=="POST" {
    cookie,err:=r.Cookie("clearance")
    if err!=nil || cookie.Value!="accepted" { t.Fatal("verification cookie not installed on API host") }
    body=`{"ok":true}`
   }
  case r.URL.Path=="/": body=`<title>Client Challenge</title>/_fs-ch-test`
  case strings.HasSuffix(r.URL.Path,"script.js"): body=`init ([{"ty":"clientmetrics","data":{"nested":[[1,2]]}}], "token", "/_fs-ch-test", true)`
  case strings.HasSuffix(r.URL.Path,"fst-post-back"):
   body=`{"status":"success"}`
   response.Header.Set("Set-Cookie","clearance=accepted; Domain=firefox.com; Path=/; HttpOnly")
  default: t.Fatal("Unexpected verification request")
  }
  response.Body=io.NopCloser(strings.NewReader(body))
  return response,nil
 })
 if err:=b.challenge(context.Background());err!=nil { t.Fatal(err) }
 if _,_,_,err:=b.fetch(context.Background(),"https://api.accounts.firefox.com/v1/account/login","POST",[]byte("{}"),nil);err!=nil { t.Fatal(err) }
 for _,agent:=range agents { if agent!=accountAgent { t.Fatal("Account user agent changed during verification") } }
}
