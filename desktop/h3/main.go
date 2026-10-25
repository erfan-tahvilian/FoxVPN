// SPDX-License-Identifier: GPL-3.0-or-later
package main

import (
 "bufio"
 "context"
 "crypto/subtle"
 "crypto/tls"
 "crypto/x509"
 "encoding/binary"
 "encoding/json"
 "errors"
 "fmt"
 "io"
 "net"
 "net/http"
 "net/netip"
 "runtime"
 "net/url"
 "os"
 "strconv"
 "strings"
 "sync"
 "time"

 "github.com/quic-go/quic-go"
 "github.com/quic-go/quic-go/http3"
)
type config struct { Host string `json:"host"`; Edge string `json:"edge"`; Edges []string `json:"edges"`; Port int `json:"port"`; Token string `json:"token"`; Secret string `json:"secret"`; Timeout int `json:"timeout"`; Type string `json:"type"` }
type destination struct { Host string `json:"host"`; Port int `json:"port"`; Secret string `json:"secret"` }
type connectError struct { Status int; Quota map[string]string }
func(e *connectError)Error()string{return fmt.Sprintf("HTTP/3 CONNECT rejected (%d)",e.Status)}
// QUIC connection setup follows firefox-vpn-client's conservative initial size
// and per-address UDP dialing. See licenses/firefox-vpn-client-MIT.txt.
type worker struct { cfg config; mu sync.Mutex; tokenMu sync.RWMutex; token string; conn *quic.Conn; udpConn *net.UDPConn; client *http3.ClientConn; transport *http3.Transport; tlsConfig *tls.Config; edgeIP string }
func(w *worker) closeLocked(){
 if w.transport!=nil{w.transport.Close();w.transport=nil}
 if w.conn!=nil{w.conn.CloseWithError(0,"");w.conn=nil}
 if w.udpConn!=nil{w.udpConn.Close();w.udpConn=nil}
 w.client=nil
}
func(w *worker)close(){w.mu.Lock();defer w.mu.Unlock();w.closeLocked()}
func(w *worker) connection(ctx context.Context)(*http3.ClientConn,error){
 w.mu.Lock();defer w.mu.Unlock()
 if w.conn!=nil {select{case <-w.conn.Context().Done():default:return w.client,nil}}
 w.closeLocked()
 timeout:=time.Duration(w.cfg.Timeout)*time.Millisecond;if timeout<=0{timeout=10*time.Second}
 ctx,cancel:=context.WithTimeout(ctx,timeout);defer cancel()
 hosts:=w.cfg.Edges
 if w.edgeIP!=""{hosts=[]string{w.edgeIP}}else if len(hosts)==0{host:=w.cfg.Edge;if host==""{host=w.cfg.Host};hosts=[]string{host}}
 var ips []netip.Addr;seen:=make(map[netip.Addr]bool)
 for _,host:=range hosts{
  addresses,err:=net.DefaultResolver.LookupNetIP(ctx,"ip",host);if err!=nil{return nil,handshakeError(err)}
  for _,ip:=range addresses{ip=ip.Unmap();if !seen[ip]{seen[ip]=true;ips=append(ips,ip)}}
 }
 if len(ips)==0{return nil,errors.New("HTTP/3 server name could not be resolved. Check your DNS connection")}
 // Prefer IPv4 when IPv6 is advertised but unavailable on the local network.
 ordered:=make([]netip.Addr,0,len(ips));for _,ip:=range ips{if ip.Is4(){ordered=append(ordered,ip)}};for _,ip:=range ips{if !ip.Is4(){ordered=append(ordered,ip)}}
 perAttempt:=timeout/time.Duration(len(ordered));if perAttempt<3*time.Second{perAttempt=3*time.Second}
 tlsCfg:=w.tlsConfig;if tlsCfg==nil{tlsCfg=&tls.Config{ServerName:w.cfg.Host,MinVersion:tls.VersionTLS13,NextProtos:[]string{http3.NextProtoH3}}}
 var lastErr error
 for _,ip:=range ordered{
  if ctx.Err()!=nil{lastErr=ctx.Err();break}
  network:="udp4";if ip.Is6(){network="udp6"}
  udp,err:=net.ListenUDP(network,&net.UDPAddr{Port:0});if err!=nil{lastErr=err;continue}
  attemptCtx,attemptCancel:=context.WithTimeout(ctx,perAttempt)
  conn,err:=quic.Dial(attemptCtx,udp,&net.UDPAddr{IP:ip.AsSlice(),Port:w.cfg.Port,Zone:ip.Zone()},tlsCfg,&quic.Config{InitialPacketSize:1200,HandshakeIdleTimeout:perAttempt,MaxIdleTimeout:60*time.Second,KeepAlivePeriod:30*time.Second,MaxIncomingStreams:-1})
  attemptCancel()
  if err!=nil{udp.Close();lastErr=err;continue}
  if conn.ConnectionState().TLS.NegotiatedProtocol!=http3.NextProtoH3{conn.CloseWithError(0,"");udp.Close();lastErr=errors.New("HTTP/3 was not negotiated");continue}
  w.transport=&http3.Transport{MaxResponseHeaderBytes:64*1024};w.conn=conn;w.udpConn=udp;w.edgeIP=ip.String();w.client=w.transport.NewClientConn(conn);return w.client,nil
 }
 return nil,handshakeError(lastErr)
}
func firefoxUserAgent()string{
 platform:="X11; Linux x86_64";switch runtime.GOOS{case "windows":platform="Windows NT 10.0; Win64; x64";case "darwin":platform="Macintosh; Intel Mac OS X 10.15";default:if runtime.GOARCH=="arm64"{platform="X11; Linux aarch64"}}
 return "Mozilla/5.0 ("+platform+"; rv:158.0) Gecko/20100101 Firefox/158.0"
}
// Classify transport failures without exposing peer addresses, tokens or raw TLS errors.
func handshakeError(err error)error{
 var timeout *quic.HandshakeTimeoutError
 var idle *quic.IdleTimeoutError
 var certificate *tls.CertificateVerificationError
 var unknownCA x509.UnknownAuthorityError
 var hostname x509.HostnameError
 var dnsError *net.DNSError
 if errors.As(err,&certificate)||errors.As(err,&unknownCA)||errors.As(err,&hostname){return errors.New("HTTP/3 certificate verification failed. Check the system clock and trusted certificates")}
 if errors.As(err,&dnsError){return errors.New("HTTP/3 server name could not be resolved. Check your DNS connection")}
 if errors.Is(err,context.DeadlineExceeded)||errors.As(err,&timeout)||errors.As(err,&idle){return errors.New("HTTP/3 handshake timed out. UDP may be blocked on this network. Choose Automatic or HTTP/2")}
 return errors.New("HTTP/3 transport could not be established. Choose Automatic or HTTP/2")
}
func(w *worker)open(ctx context.Context,host string,port int)(*http3.RequestStream,error){
 client,err:=w.connection(ctx);if err!=nil{return nil,err}
 stream,err:=client.OpenRequestStream(ctx);if err!=nil{return nil,err}
 stream.SetDeadline(time.Now().Add(15*time.Second))
 w.tokenMu.RLock();token:=w.token;w.tokenMu.RUnlock()
 authority:=net.JoinHostPort(host,strconv.Itoa(port))
 req:=&http.Request{Method:http.MethodConnect,URL:&url.URL{Scheme:"https",Host:authority},Host:authority,Header:make(http.Header)}
 req.Header.Set("Proxy-Authorization","Bearer "+token)
 req.Header.Set("User-Agent",firefoxUserAgent())
 if err=stream.SendRequestHeader(req);err==nil{var response *http.Response;response,err=stream.ReadResponse();if err==nil&&response.StatusCode/100!=2{err=&connectError{Status:response.StatusCode,Quota:map[string]string{"limit":response.Header.Get("X-Quota-Limit"),"remaining":response.Header.Get("X-Quota-Remaining"),"reset":response.Header.Get("X-Quota-Reset")}}}}
 if err!=nil{stream.CancelRead(0);stream.CancelWrite(0);return nil,err};stream.SetDeadline(time.Time{});return stream,nil
}
func frame(conn net.Conn,value any)error{data,err:=json.Marshal(value);if err!=nil{return err};var size [4]byte;binary.BigEndian.PutUint32(size[:],uint32(len(data)));if _,err=conn.Write(size[:]);err!=nil{return err};_,err=conn.Write(data);return err}
func validHost(host string)bool{return host!=""&&len(host)<=253&&!strings.ContainsAny(host,"\r\n\x00/ ")}
func(w *worker)handle(conn net.Conn){
 defer conn.Close();conn.SetDeadline(time.Now().Add(15*time.Second))
 var size [4]byte;if _,err:=io.ReadFull(conn,size[:]);err!=nil{return};n:=binary.BigEndian.Uint32(size[:]);if n==0||n>4096{return};data:=make([]byte,n);if _,err:=io.ReadFull(conn,data);err!=nil{return}
 var target destination;if json.Unmarshal(data,&target)!=nil||subtle.ConstantTimeCompare([]byte(target.Secret),[]byte(w.cfg.Secret))!=1||!validHost(target.Host)||target.Port<1||target.Port>65535{return}
 stream,err:=w.open(context.Background(),target.Host,target.Port);if err!=nil{reply:=map[string]any{"ok":false,"error":"HTTP/3 tunnel could not be opened"};var rejected *connectError;if errors.As(err,&rejected){reply["status"]=rejected.Status;reply["quota"]=rejected.Quota};frame(conn,reply);return}
 defer stream.CancelRead(0);defer stream.CancelWrite(0)
 if frame(conn,map[string]any{"ok":true})!=nil{return};conn.SetDeadline(time.Time{})
 done:=make(chan struct{});go func(){io.Copy(stream,conn);stream.Close();close(done)}();io.Copy(conn,stream);conn.Close();stream.CancelWrite(0);<-done
}
func run()error{
 scanner:=bufio.NewScanner(os.Stdin);scanner.Buffer(make([]byte,4096),65536);if !scanner.Scan(){return errors.New("Missing transport configuration")}
 var cfg config;if json.Unmarshal(scanner.Bytes(),&cfg)!=nil||!validHost(cfg.Host)||cfg.Port<1||cfg.Port>65535||len(cfg.Secret)<32||cfg.Token==""{return errors.New("Invalid transport configuration")}
 if cfg.Timeout<=0{cfg.Timeout=10000};w:=&worker{cfg:cfg,token:cfg.Token};ctx,cancel:=context.WithTimeout(context.Background(),time.Duration(max(cfg.Timeout,1000))*time.Millisecond);defer cancel();if _,err:=w.connection(ctx);err!=nil{return err};defer w.close()
 listener,err:=net.Listen("tcp","127.0.0.1:0");if err!=nil{return err};defer listener.Close()
 if err=json.NewEncoder(os.Stdout).Encode(map[string]any{"port":listener.Addr().(*net.TCPAddr).Port,"protocol":"h3","edgeIP":w.edgeIP});err!=nil{return err}
 go func(){for scanner.Scan(){var update config;if json.Unmarshal(scanner.Bytes(),&update)==nil&&update.Type=="token"&&update.Token!=""{w.tokenMu.Lock();w.token=update.Token;w.tokenMu.Unlock()}};listener.Close();w.close()}()
 for{conn,err:=listener.Accept();if err!=nil{return nil};go w.handle(conn)}
}
func main(){if err:=run();err!=nil{json.NewEncoder(os.Stdout).Encode(map[string]any{"error":err.Error()});os.Exit(1)}}
