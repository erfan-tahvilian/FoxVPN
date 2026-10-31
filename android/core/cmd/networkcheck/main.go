// SPDX-License-Identifier: GPL-3.0-or-later
// Developer diagnostic: QUIC handshakes only, without account credentials.
package main

import (
 "context"
 "crypto/tls"
 "crypto/x509"
 "encoding/json"
 "flag"
 "fmt"
 "net"
 "os"
 "strings"
 "sync"
 "time"

 "github.com/sagernet/quic-go"
)

func main() {
 dns := flag.String("dns", "", "Physical network DNS server IP")
 ca := flag.String("ca", "", "Trusted PEM certificate bundle")
 targets := flag.String("targets", "p.m1.fastly-masque.net:2499,muc139.m1.fastly-masque.net:2499,www.google.com:443", "Comma-separated TLS host:port targets")
 flag.Parse()
 roots := x509.NewCertPool()
 pem, err := os.ReadFile(*ca)
 if err != nil || !roots.AppendCertsFromPEM(pem) { fmt.Fprintln(os.Stderr,"A trusted CA bundle is required"); os.Exit(1) }
 resolver := net.DefaultResolver
 if *dns != "" {
  if net.ParseIP(*dns)==nil { fmt.Fprintln(os.Stderr,"Invalid DNS IP"); os.Exit(1) }
  resolver=&net.Resolver{PreferGo:true,Dial:func(ctx context.Context,network,address string)(net.Conn,error){return (&net.Dialer{}).DialContext(ctx,network,net.JoinHostPort(*dns,"53"))}}
 }
 var wg sync.WaitGroup
 var output sync.Mutex
 emit:=func(value any){output.Lock();defer output.Unlock();json.NewEncoder(os.Stdout).Encode(value)}
 for _, target:=range strings.Split(*targets,",") {
  host,port,err:=net.SplitHostPort(target)
  if err!=nil { emit(map[string]any{"target":target,"error":"Invalid target"});continue }
  ctx,cancel:=context.WithTimeout(context.Background(),8*time.Second)
  ips,err:=resolver.LookupIPAddr(ctx,host);cancel()
  if err!=nil { emit(map[string]any{"target":target,"dnsError":err.Error()});continue }
  for _, ip:=range ips {
   wg.Add(1)
   go func(target,host,port string,ip net.IPAddr){
    defer wg.Done()
    ctx,cancel:=context.WithTimeout(context.Background(),6*time.Second);defer cancel()
    started:=time.Now()
    network,bind:="udp4","0.0.0.0:0"
    if ip.IP.To4()==nil {network,bind="udp6","[::]:0"}
    result:=map[string]any{"target":target,"ip":ip.String(),"family":network}
    socket,err:=(&net.ListenConfig{}).ListenPacket(ctx,network,bind)
    if err==nil {
     defer socket.Close()
     address,resolveErr:=net.ResolveUDPAddr(network,net.JoinHostPort(ip.String(),port))
     if resolveErr!=nil {err=resolveErr} else {
      conn,dialErr:=quic.Dial(ctx,socket,address,&tls.Config{RootCAs:roots,ServerName:host,MinVersion:tls.VersionTLS13,NextProtos:[]string{"h3"}},&quic.Config{InitialPacketSize:1200,HandshakeIdleTimeout:6*time.Second})
      err=dialErr
      if err==nil {result["handshake"]="verified";conn.CloseWithError(0,"")}
     }
    }
    if err!=nil {result["error"]=err.Error()}
    result["elapsedMs"]=time.Since(started).Milliseconds();emit(result)
   }(target,host,port,ip)
  }
 }
 wg.Wait()
}
