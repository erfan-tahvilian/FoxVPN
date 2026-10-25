// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import (
 "context"
 "crypto/tls"
 "errors"
 "net"
 "net/http"
 "time"

 "github.com/sagernet/quic-go"
 "github.com/sagernet/quic-go/http3"
)

type mobileH3 struct{conn quic.Connection;udp net.PacketConn;client *http3.ClientConn;transport *http3.Transport}
func(h *mobileH3)close(){if h!=nil{h.transport.Close();h.conn.CloseWithError(0,"");h.udp.Close()}}
func(t *proxyTunnel)protocolName()string{t.mu.Lock();defer t.mu.Unlock();if t.h3!=nil&&!t.h3fallback{return "http/3"};return "http/2"}
func(b *Backend)protocolLocked()string{if b.tunnel!=nil&&b.tunnel.protocolName()=="http/3"{return "h3"};return "h2"}
// The socket is protected before binding, so QUIC packets never re-enter the
// platform VPN. TLS continues to verify the original proxy hostname.
func(t *proxyTunnel)h3Session(ctx context.Context)(*http3.ClientConn,error){
 t.sessionMu.Lock();defer t.sessionMu.Unlock();t.mu.Lock();h,closed:=t.h3,t.closed;t.mu.Unlock();if closed{return nil,context.Canceled}
 if h!=nil{select{case<-h.conn.Context().Done():t.mu.Lock();t.h3=nil;t.mu.Unlock();h.close();default:return h.client,nil}}
 timeout:=10*time.Second;if str(t.settings,"transport")!="h3"{timeout=3500*time.Millisecond};ctx,cancel:=context.WithTimeout(ctx,timeout);defer cancel()
 host:=str(t.settings,"edge");if host==""{host=str(t.server,"host")};addresses,err:=t.b.dialer.Resolver.LookupIPAddr(ctx,host);if err!=nil{return nil,err};if len(addresses)==0{return nil,errors.New("HTTP/3 server name could not be resolved")}
 ips:=[]net.IPAddr{};for _,a:=range addresses{if a.IP.To4()!=nil{ips=append(ips,a)}};for _,a:=range addresses{if a.IP.To4()==nil{ips=append(ips,a)}}
 perAttempt:=timeout/time.Duration(len(ips));if perAttempt<3*time.Second{perAttempt=3*time.Second};var last error
 for _,ip:=range ips{
  if ctx.Err()!=nil{break};network,bind:="udp4","0.0.0.0:0";if ip.IP.To4()==nil{network,bind="udp6","[::]:0"}
  lc:=net.ListenConfig{Control:t.b.dialer.Control};udp,err:=lc.ListenPacket(ctx,network,bind);if err!=nil{last=err;continue}
  attempt,stop:=context.WithTimeout(ctx,perAttempt);conn,err:=quic.Dial(attempt,udp,&net.UDPAddr{IP:ip.IP,Zone:ip.Zone,Port:int(num(t.server,"port"))},&tls.Config{RootCAs:t.b.roots,ServerName:str(t.server,"host"),MinVersion:tls.VersionTLS13,NextProtos:[]string{"h3"}},&quic.Config{InitialPacketSize:1200,HandshakeIdleTimeout:perAttempt,KeepAlivePeriod:30*time.Second,MaxIdleTimeout:time.Minute,MaxIncomingStreams:-1});stop()
  if err!=nil{udp.Close();last=err;continue};transport:=&http3.Transport{MaxResponseHeaderBytes:64*1024};h=&mobileH3{conn:conn,udp:udp,transport:transport,client:transport.NewClientConn(conn)}
  t.mu.Lock();if t.closed{t.mu.Unlock();h.close();return nil,context.Canceled};t.h3=h;t.mu.Unlock();return h.client,nil
 }
 if ctx.Err()!=nil{return nil,errors.New("HTTP/3 handshake timed out. Choose Automatic or HTTP/2 on this network")};if last==nil{last=errors.New("No HTTP/3 edge is available")};return nil,last
}
func(t *proxyTunnel)roundTrip(ctx context.Context,req *http.Request)(*http.Response,error){
 mode:=str(t.settings,"transport");t.mu.Lock();fallback:=t.h3fallback;t.mu.Unlock()
 if mode!="h2"&&!fallback{
  var client *http3.ClientConn;var err error
  if yes(obj(t.settings,"upstream"),"enabled"){err=errors.New("HTTP/3 requires direct UDP. Disable the upstream proxy or choose Automatic")}else{client,err=t.h3Session(ctx)}
  if err==nil{return client.RoundTrip(req)}
  if mode=="h3"||ctx.Err()!=nil||t.ctx.Err()!=nil{return nil,err};t.mu.Lock();t.h3fallback=true;t.mu.Unlock();t.b.log("info","HTTP/3 unavailable. Using HTTP/2 over TLS.")
 }
 session,err:=t.session(ctx);if err!=nil{return nil,err};return session.RoundTrip(req)
}
