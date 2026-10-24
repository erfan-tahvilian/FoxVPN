// SPDX-License-Identifier: GPL-3.0-or-later
package main
import("context";"crypto/tls";"crypto/x509";"io";"net";"net/http";"os";"strconv";"testing";"time";"github.com/quic-go/quic-go/http3")
func TestRealHTTP3ConnectAndRejection(t *testing.T){
 cert,err:=tls.LoadX509KeyPair("../../tests/fixtures/localhost-cert.pem","../../tests/fixtures/localhost-test-key.pem");if err!=nil{t.Fatal(err)}
 udp,err:=net.ListenPacket("udp","127.0.0.1:0");if err!=nil{t.Fatal(err)}
 server:=&http3.Server{TLSConfig:&tls.Config{Certificates:[]tls.Certificate{cert}},Handler:http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){if r.Method!="CONNECT"||r.Host!="example.com:443"||r.Header.Get("Proxy-Authorization")!="Bearer fixture"{w.Header().Set("X-Quota-Remaining","0");w.WriteHeader(429);return};w.WriteHeader(200);w.(http.Flusher).Flush();buf:=make([]byte,4);if _,err:=io.ReadFull(r.Body,buf);err!=nil{return};w.Write(buf);w.(http.Flusher).Flush()})}
 go server.Serve(udp);defer server.Close();defer udp.Close();roots:=x509.NewCertPool();pem,_:=os.ReadFile("../../tests/fixtures/localhost-cert.pem");roots.AppendCertsFromPEM(pem)
 _,port,_:=net.SplitHostPort(udp.LocalAddr().String());p,_:=strconv.Atoi(port)
 worker:=&worker{cfg:config{Host:"localhost",Edge:"127.0.0.1",Port:p,Timeout:2000},token:"fixture",tlsConfig:&tls.Config{ServerName:"localhost",RootCAs:roots,MinVersion:tls.VersionTLS13,NextProtos:[]string{"h3"}}}
 ctx,cancel:=context.WithTimeout(context.Background(),5*time.Second);defer cancel();stream,err:=worker.open(ctx,"example.com",443);if err!=nil{t.Fatal(err)};defer stream.CancelRead(0);defer stream.CancelWrite(0);if _,err=stream.Write([]byte("ping"));err!=nil{t.Fatal(err)};data:=make([]byte,4);if _,err=io.ReadFull(stream,data);err!=nil{t.Fatal(err)};if string(data)!="ping"{t.Fatal("wrong tunnel payload")};worker.tokenMu.Lock();worker.token="rejected";worker.tokenMu.Unlock();_,err=worker.open(ctx,"example.com",443);if rejected,ok:=err.(*connectError);!ok||rejected.Status!=429||rejected.Quota["remaining"]!="0"{t.Fatalf("missing quota rejection: %v",err)};worker.conn.CloseWithError(0,"")
}
