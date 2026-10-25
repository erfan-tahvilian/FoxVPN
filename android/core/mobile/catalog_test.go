// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import("io";"net/http";"strings";"testing";"time")

type delayedCatalog struct{entered chan struct{};release chan struct{}}
func(c delayedCatalog)RoundTrip(*http.Request)(*http.Response,error){
 close(c.entered);<-c.release
 return &http.Response{StatusCode:200,Header:make(http.Header),Body:io.NopCloser(strings.NewReader(`{"data":[{"code":"DE","name":"Germany","cities":[{"code":"MUC","name":"Munich","servers":[{"hostname":"muc.example","port":443}]}]}]}`))},nil
}
func TestAccountSelectionDoesNotWaitForPublicCatalog(t *testing.T){
 b:=NewBackend(&testHost{},"{}");if err:=b.addAccount(fixtureAuth("one@example.com","one"));err!=nil{t.Fatal(err)};if err:=b.addAccount(fixtureAuth("two@example.com","two"));err!=nil{t.Fatal(err)}
 id:=str(b.accounts[1],"id");entered,release,done:=make(chan struct{}),make(chan struct{}),make(chan struct{})
 b.client=&http.Client{Transport:delayedCatalog{entered,release}}
 go func(){b.Call("servers","[]");close(done)}()
 <-entered;defer func(){close(release);<-done}()
 selected:=make(chan string,1);go func(){selected<-b.Call("selectAccount",`["`+id+`"]`)}()
 select{case response:=<-selected:if !strings.Contains(response,`"ok":true`)||b.activeAccountID!=id{t.Fatal("Account was not selected",response)};case <-time.After(time.Second):t.Fatal("Local account selection waited for the catalog network request")}
}

type delayedQuota struct{entered chan struct{};release chan struct{}}
func(q delayedQuota)RoundTrip(request *http.Request)(*http.Response,error){
 close(q.entered);<-q.release
 return &http.Response{StatusCode:200,Header:make(http.Header),Body:io.NopCloser(strings.NewReader(`{"limited_bandwidth":false}`))},nil
}
func TestAllowanceRefreshStaysWithItsOriginalAccount(t *testing.T){
 b:=NewBackend(&testHost{},"{}");b.addAccount(fixtureAuth("one@example.com","one"));b.addAccount(fixtureAuth("two@example.com","two"))
 first,second:=str(b.accounts[0],"id"),str(b.accounts[1],"id")
 entered,release,done:=make(chan struct{}),make(chan struct{}),make(chan struct{})
 b.client=&http.Client{Transport:delayedQuota{entered,release}}
 go func(){b.Call("account","[]");close(done)}();<-entered
 selected:=make(chan string,1);go func(){selected<-b.Call("selectAccount",`["`+second+`"]`)}()
 select{case response:=<-selected:if !strings.Contains(response,`"ok":true`){close(release);<-done;t.Fatal(response)};case <-time.After(time.Second):close(release);<-done;t.Fatal("Account selection waited for allowance refresh")}
 close(release);<-done
 b.mu.Lock();defer b.mu.Unlock()
 if b.activeAccountID!=second||!yes(obj(b.profileLocked(first),"quota"),"unlimited")||yes(obj(b.profileLocked(second),"quota"),"unlimited"){t.Fatal("Delayed allowance was applied to the wrong account")}
}
