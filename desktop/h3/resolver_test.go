// SPDX-License-Identifier: GPL-3.0-or-later
package main

import (
 "context"
 "net/netip"
 "testing"
 "time"
 "golang.org/x/net/dns/dnsmessage"
)

func TestEncryptedDNSValidation(t *testing.T){
 name:=dnsmessage.MustNewName("edge.example.")
 query:=dnsmessage.Message{Header:dnsmessage.Header{ID:19},Questions:[]dnsmessage.Question{{Name:name,Type:dnsmessage.TypeA,Class:dnsmessage.ClassINET}}}
 alias:=dnsmessage.MustNewName("alias.example.")
 response:=dnsmessage.Message{Header:dnsmessage.Header{ID:19,Response:true},Questions:query.Questions,Answers:[]dnsmessage.Resource{
  {Header:dnsmessage.ResourceHeader{Name:name,Type:dnsmessage.TypeCNAME,Class:dnsmessage.ClassINET},Body:&dnsmessage.CNAMEResource{CNAME:alias}},
  {Header:dnsmessage.ResourceHeader{Name:alias,Type:dnsmessage.TypeA,Class:dnsmessage.ClassINET},Body:&dnsmessage.AResource{A:[4]byte{23,235,42,8}}},
  {Header:dnsmessage.ResourceHeader{Name:dnsmessage.MustNewName("unrelated.example."),Type:dnsmessage.TypeA,Class:dnsmessage.ClassINET},Body:&dnsmessage.AResource{A:[4]byte{8,8,8,8}}},
 }}
 wire,err:=response.Pack();if err!=nil{t.Fatal(err)}
 ips,err:=parseEdgeDNS(query,wire);if err!=nil||len(ips)!=1||ips[0].String()!="23.235.42.8"{t.Fatalf("unexpected answer: %v %v",ips,err)}
 response.ID++;wire,_=response.Pack();if _,err=parseEdgeDNS(query,wire);err==nil{t.Fatal("accepted mismatched response")}
 response.ID--;response.Answers=response.Answers[2:];wire,_=response.Pack();if _,err=parseEdgeDNS(query,wire);err==nil{t.Fatal("accepted unrelated answer")}
}

func TestEncryptedDNSProviderRaceCancelsLosers(t *testing.T){
 stopped:=make(chan struct{})
 ips,err:=raceEdgeProviders(context.Background(),[]string{"fast","slow"},func(ctx context.Context,server string)([]netip.Addr,error){
  if server=="fast"{return []netip.Addr{netip.MustParseAddr("23.235.42.8")},nil}
  <-ctx.Done();close(stopped);return nil,ctx.Err()
 })
 if err!=nil||len(ips)!=1{t.Fatalf("no winning answer: %v",err)}
 select{case <-stopped:case <-time.After(time.Second):t.Fatal("losing query not cancelled")}
}

func TestExplicitEdgeBypassesEncryptedDNS(t *testing.T){
 ips,err:=resolveEdge(context.Background(),"127.0.0.1","automatic")
 if err!=nil||len(ips)!=1||!ips[0].IsLoopback(){t.Fatalf("literal edge changed: %v %v",ips,err)}
}
