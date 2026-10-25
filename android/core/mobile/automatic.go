// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import (
 "context"
 "errors"
 "net/http"
 "time"
)

// Each contender owns its sockets. Selection keeps the first verified HTTPS
// path; closing the loser cannot tear down the selected connection.
func(t *proxyTunnel) automatic(ctx context.Context)(*proxyTunnel,error){
 t.automaticMu.Lock();defer t.automaticMu.Unlock()
 t.mu.Lock();selected,closed,token,id:=t.selected,t.closed,t.token,t.accountID;t.mu.Unlock()
 if closed{return nil,context.Canceled};if selected!=nil{return selected,nil}
 address:=t.probeAddress;if address==""{address="https://www.google.com/generate_204"}
 probes:=make([]*proxyTunnel,0,2)
 type result struct{tunnel *proxyTunnel;err error};answers:=make(chan result,2)
 for _,mode:=range []string{"h3","h2"}{
  settings:=copyObject(t.settings);settings["transport"]=mode
  probe:=newTunnel(t.b,settings,t.server,token,t.ctx);probe.accountID=id
  probes=append(probes,probe)
  go func(probe *proxyTunnel){attempt,cancel:=context.WithTimeout(ctx,25*time.Second);defer cancel();_,err:=probe.request(attempt,address,nil,"",http.StatusOK,http.StatusNoContent);answers<-result{probe,err}}(probe)
 }
 var winner *proxyTunnel
 defer func(){for _,probe:=range probes{if probe!=winner{probe.close()}}}()
 failures:=[]error{}
 for range probes{select{
 case <-ctx.Done():return nil,ctx.Err()
 case answer:=<-answers:
  if answer.err!=nil{failures=append(failures,answer.err);continue}
  t.mu.Lock()
  if t.closed{t.mu.Unlock();return nil,context.Canceled}
  t.selected=answer.tunnel;t.h3fallback=str(answer.tunnel.settings,"transport")=="h2";token=t.token
  t.mu.Unlock()
  winner=answer.tunnel;winner.setToken(token);winner.requestTransport.CloseIdleConnections()
  t.b.log("info","Automatic selected "+winner.protocolName()+" after a successful HTTPS response")
  return winner,nil
 }}
 return nil,errors.Join(failures...)
}

// Failed CONNECT request bodies are not replayed. Future streams use HTTP/2
// if a previously selected QUIC path breaks.
func(t *proxyTunnel) fallbackAfter(selected *proxyTunnel){
 if str(selected.settings,"transport")!="h3"{return}
 t.automaticMu.Lock();defer t.automaticMu.Unlock()
 t.mu.Lock()
 if t.closed||t.selected!=selected{t.mu.Unlock();return}
 settings:=copyObject(t.settings);settings["transport"]="h2";token,id:=t.token,t.accountID;t.mu.Unlock()
 next:=newTunnel(t.b,settings,t.server,token,t.ctx);next.accountID=id
 t.mu.Lock();if t.closed{t.mu.Unlock();next.close();return};t.selected=next;t.h3fallback=true;token=t.token;t.mu.Unlock();next.setToken(token)
 selected.close();t.b.log("info","HTTP/3 interrupted. New connections will use HTTP/2 over TLS")
}
