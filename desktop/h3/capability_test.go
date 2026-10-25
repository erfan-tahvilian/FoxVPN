// SPDX-License-Identifier: GPL-3.0-or-later
package main
import("context";"os";"testing";"time")
func TestPublicProxyCapability(t *testing.T){host:=os.Getenv("FOX_PUBLIC_H3_HOST");if host==""{t.Skip("public endpoint probe is opt-in")};for _,port:=range []int{2499,443}{w:=&worker{cfg:config{Host:host,Port:port,Timeout:3000},token:"capability-probe-without-account"};ctx,cancel:=context.WithTimeout(context.Background(),5*time.Second);stream,err:=w.open(ctx,"example.com",443);cancel();if stream!=nil{stream.CancelRead(0);stream.CancelWrite(0)};w.close();if e,ok:=err.(*connectError);ok{t.Logf("HTTP/3 verified on port %d; unauthenticated CONNECT rejected with %d",port,e.Status);return};t.Logf("port %d: %v",port,err)};t.Fatal("public endpoint did not establish an HTTP/3 proxy connection")}
