// SPDX-License-Identifier: GPL-3.0-or-later
package main

import (
 "bufio"
 "context"
 "crypto/subtle"
 "crypto/tls"
 "encoding/binary"
 "encoding/json"
 "errors"
 "fmt"
 "io"
 "net"
 "net/http"
 "net/url"
 "os"
 "strconv"
 "strings"
 "sync"
 "time"

 "github.com/quic-go/quic-go"
 "github.com/quic-go/quic-go/http3"
)
type config struct { Host string `json:"host"`; Edge string `json:"edge"`; Port int `json:"port"`; Token string `json:"token"`; Secret string `json:"secret"`; Timeout int `json:"timeout"`; Type string `json:"type"` }
type destination struct { Host string `json:"host"`; Port int `json:"port"`; Secret string `json:"secret"` }
type connectError struct { Status int; Quota map[string]string }
func(e *connectError)Error()string{return fmt.Sprintf("HTTP/3 CONNECT rejected (%d)",e.Status)}
type worker struct { cfg config; mu sync.Mutex; tokenMu sync.RWMutex; token string; conn *quic.Conn; client *http3.ClientConn; transport *http3.Transport; tlsConfig *tls.Config }
func(w *worker) connection(ctx context.Context)(*http3.ClientConn,error){
 w.mu.Lock();defer w.mu.Unlock()
 if w.conn!=nil {select{case <-w.conn.Context().Done():default:return w.client,nil}}
 host:=w.cfg.Edge;if host==""{host=w.cfg.Host};timeout:=time.Duration(w.cfg.Timeout)*time.Millisecond;if timeout<=0{timeout=3500*time.Millisecond}
 tlsCfg:=w.tlsConfig;if tlsCfg==nil{tlsCfg=&tls.Config{ServerName:w.cfg.Host,MinVersion:tls.VersionTLS13,NextProtos:[]string{http3.NextProtoH3}}}
 conn,err:=quic.DialAddr(ctx,net.JoinHostPort(host,strconv.Itoa(w.cfg.Port)),tlsCfg,&quic.Config{HandshakeIdleTimeout:timeout,MaxIdleTimeout:60*time.Second,KeepAlivePeriod:15*time.Second,MaxIncomingStreams:-1})
 if err!=nil{return nil,errors.New("HTTP/3 connection could not be established")}
 w.transport=&http3.Transport{MaxResponseHeaderBytes:64*1024};w.conn=conn;w.client=w.transport.NewClientConn(conn);return w.client,nil
}
func(w *worker)open(ctx context.Context,host string,port int)(*http3.RequestStream,error){
 client,err:=w.connection(ctx);if err!=nil{return nil,err}
 stream,err:=client.OpenRequestStream(ctx);if err!=nil{return nil,err}
 stream.SetDeadline(time.Now().Add(15*time.Second))
 w.tokenMu.RLock();token:=w.token;w.tokenMu.RUnlock()
 authority:=net.JoinHostPort(host,strconv.Itoa(port))
 req:=&http.Request{Method:http.MethodConnect,URL:&url.URL{Scheme:"https",Host:authority},Host:authority,Header:make(http.Header)}
 req.Header.Set("Proxy-Authorization","Bearer "+token)
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
 w:=&worker{cfg:cfg,token:cfg.Token};ctx,cancel:=context.WithTimeout(context.Background(),10*time.Second);defer cancel();if _,err:=w.connection(ctx);err!=nil{return err};defer w.conn.CloseWithError(0,"")
 listener,err:=net.Listen("tcp","127.0.0.1:0");if err!=nil{return err};defer listener.Close()
 if err=json.NewEncoder(os.Stdout).Encode(map[string]any{"port":listener.Addr().(*net.TCPAddr).Port,"protocol":"h3"});err!=nil{return err}
 go func(){for scanner.Scan(){var update config;if json.Unmarshal(scanner.Bytes(),&update)==nil&&update.Type=="token"&&update.Token!=""{w.tokenMu.Lock();w.token=update.Token;w.tokenMu.Unlock()}};listener.Close();w.mu.Lock();if w.conn!=nil{w.conn.CloseWithError(0,"")};w.mu.Unlock()}()
 for{conn,err:=listener.Accept();if err!=nil{return nil};go w.handle(conn)}
}
func main(){if err:=run();err!=nil{json.NewEncoder(os.Stdout).Encode(map[string]any{"error":err.Error()});os.Exit(1)}}
