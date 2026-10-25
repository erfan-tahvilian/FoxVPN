// SPDX-License-Identifier: GPL-3.0-or-later
package main
import("errors";"strings";"github.com/quic-go/quic-go";"context";"crypto/tls";"crypto/x509";"io";"net";"net/http";"os";"strconv";"testing";"sync/atomic";"time";"github.com/quic-go/quic-go/http3")
// The fixture discards oversized client datagrams to model a low-MTU path.
type mtuPacketConn struct{net.PacketConn;first atomic.Int64;oversized atomic.Int64}
func(c *mtuPacketConn)ReadFrom(p []byte)(int,net.Addr,error){
 for{n,a,err:=c.PacketConn.ReadFrom(p);if err!=nil{return n,a,err};c.first.CompareAndSwap(0,int64(n));if n>1200{c.oversized.Add(1);continue};return n,a,nil}
}
func proxyFixture(t *testing.T)(int,*tls.Config,*mtuPacketConn){
 t.Helper()
 cert,err:=tls.LoadX509KeyPair("../../tests/fixtures/localhost-cert.pem","../../tests/fixtures/localhost-test-key.pem");if err!=nil{t.Fatal(err)}
 udp,err:=net.ListenPacket("udp","127.0.0.1:0");if err!=nil{t.Fatal(err)}
 limited:=&mtuPacketConn{PacketConn:udp}
 server:=&http3.Server{TLSConfig:&tls.Config{Certificates:[]tls.Certificate{cert}},Handler:http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){if r.Method!="CONNECT"||r.Host!="example.com:443"||r.Header.Get("Proxy-Authorization")!="Bearer fixture"||!strings.Contains(r.UserAgent(),"Firefox/"){w.Header().Set("X-Quota-Remaining","0");w.WriteHeader(429);return};w.WriteHeader(200);w.(http.Flusher).Flush();buf:=make([]byte,4);if _,err:=io.ReadFull(r.Body,buf);err!=nil{return};w.Write(buf);w.(http.Flusher).Flush()})}
 go server.Serve(limited);t.Cleanup(func(){server.Close();udp.Close()})
 roots:=x509.NewCertPool();pem,err:=os.ReadFile("../../tests/fixtures/localhost-cert.pem");if err!=nil{t.Fatal(err)};roots.AppendCertsFromPEM(pem)
 _,port,_:=net.SplitHostPort(udp.LocalAddr().String());p,_:=strconv.Atoi(port)
 return p,&tls.Config{ServerName:"localhost",RootCAs:roots,MinVersion:tls.VersionTLS13,NextProtos:[]string{"h3"}},limited
}
func echoThroughProxy(t *testing.T,w *worker){
 t.Helper();ctx,cancel:=context.WithTimeout(context.Background(),12*time.Second);defer cancel()
 stream,err:=w.open(ctx,"example.com",443);if err!=nil{t.Fatal(err)};defer stream.CancelRead(0);defer stream.CancelWrite(0)
 stream.SetDeadline(time.Now().Add(3*time.Second))
 if _,err=stream.Write([]byte("ping"));err!=nil{t.Fatal(err)};data:=make([]byte,4);if _,err=io.ReadFull(stream,data);err!=nil{t.Fatal(err)};if string(data)!="ping"{t.Fatal("wrong tunnel payload")}
}
func TestRealHTTP3ConnectAndRejection(t *testing.T){
 port,tlsConfig,limited:=proxyFixture(t)
 w:=&worker{cfg:config{Host:"localhost",Edge:"127.0.0.1",Port:port,Timeout:2000},token:"fixture",tlsConfig:tlsConfig};defer w.close()
 echoThroughProxy(t,w)
 if n:=limited.first.Load();n!=1200{t.Fatalf("initial UDP datagram must fit low-MTU path, got %d",n)}
 w.tokenMu.Lock();w.token="rejected";w.tokenMu.Unlock()
 _,err:=w.open(context.Background(),"example.com",443);if rejected,ok:=err.(*connectError);!ok||rejected.Status!=429||rejected.Quota["remaining"]!="0"{t.Fatalf("missing quota rejection: %v",err)}
}
func TestHTTP3TriesNextAddressAndClosesUDPSocket(t *testing.T){
 port,tlsConfig,_:=proxyFixture(t)
 w:=&worker{cfg:config{Host:"localhost",Edges:[]string{"127.0.0.2","127.0.0.1"},Port:port,Timeout:8000},token:"fixture",tlsConfig:tlsConfig};defer w.close()
 echoThroughProxy(t,w)
 if w.edgeIP!="127.0.0.1"{t.Fatalf("did not report working edge address: %s",w.edgeIP)}
 udp:=w.udpConn;w.close()
 if _,err:=udp.WriteToUDP([]byte("closed"),&net.UDPAddr{IP:net.IPv4(127,0,0,1),Port:port});!errors.Is(err,net.ErrClosed){t.Fatalf("UDP socket not closed: %v",err)}
}

func TestHandshakeDiagnostics(t *testing.T){
 cases:=[]struct{err error;part string}{{context.DeadlineExceeded,"UDP may be blocked"},{&quic.HandshakeTimeoutError{},"UDP may be blocked"},{&net.DNSError{Err:"unreachable",Name:"private-name.example"},"DNS"},{&tls.CertificateVerificationError{Err:x509.UnknownAuthorityError{}},"certificate"},{errors.New("private-peer-address"),"transport"}}
 for _,c:=range cases{message:=handshakeError(c.err).Error();if !strings.Contains(message,c.part)||strings.Contains(message,"private-"){t.Fatalf("unsafe or incorrect transport diagnostic: %s",message)}}
}
