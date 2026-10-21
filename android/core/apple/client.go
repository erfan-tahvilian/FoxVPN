// SPDX-License-Identifier: GPL-3.0-or-later
// Package apple binds the shared VPN backend to Apple's Network Extension host.
package apple

import (
    "encoding/json"
    "errors"
    "runtime/debug"
    "os"
    "net"
    "strings"
    "syscall"
    "path/filepath"
    "sync"
    "foxvpn/android/core/mobile"
    "github.com/sagernet/sing-box/experimental/libbox"
)

type Host interface {
    SaveVault(vault string) bool
    Changed(state string)
    Certificates() string
    DNSAddress() string
    OpenTun(plan string) int32
}
type Client struct {
    host Host
    backend *mobile.Backend
    engine *libbox.BoxService
    engineMu sync.Mutex
    pathMu sync.Mutex
    path pathState
    listener libbox.InterfaceUpdateListener
    setupError error
}
type pathState struct { Name string `json:"name"`; Index int32 `json:"index"`; Expensive bool `json:"expensive"`; Constrained bool `json:"constrained"` }
func NewClient(host Host,vault,workDir string)*Client {
    // Keep Go-managed memory below the packet-tunnel extension budget.
    debug.SetMemoryLimit(32 << 20)
    c:=&Client{host:host}
    c.setupError=os.MkdirAll(workDir,0700)
    if c.setupError==nil {c.setupError=libbox.Setup(&libbox.SetupOptions{BasePath:workDir,WorkingPath:workDir,TempPath:filepath.Join(workDir,"tmp")})}
    libbox.SetLocale("en")
    c.backend=mobile.NewAppleBackend(c,vault)
    return c
}
func (c *Client) Save(value string)error {if !c.host.SaveVault(value){return errors.New("Keychain storage could not be updated")};return nil}
func (c *Client) Changed(value string){c.host.Changed(value)}
func (c *Client) Protect(fd int32)bool{return true}
func (c *Client) DNSAddress()string{return c.host.DNSAddress()}
func (c *Client) Certificates()string{return c.host.Certificates()}
func (c *Client) Snapshot()string{return c.backend.Snapshot()}
func (c *Client) SetDark(dark bool){c.backend.SetDark(dark)}
func failure(err error)string{data,_:=json.Marshal(map[string]any{"ok":false,"error":err.Error()});return string(data)}
func (c *Client) Call(channel,args string)string {
    if c.setupError!=nil {return failure(c.setupError)}
    if channel=="disconnect"||channel=="cancel" {c.Stop();return `{"ok":true,"data":null}`}
    if channel=="settings" {
        var values []map[string]any
        if json.Unmarshal([]byte(args),&values)!=nil||len(values)!=1{return failure(errors.New("Invalid settings"))}
        s:=values[0]
        if enabled,_:=s["proxyOnly"].(bool);enabled{return failure(errors.New("Proxy-only background operation is unavailable on iOS"))}
        if items,_:=s["excludedApps"].([]any);len(items)>0{return failure(errors.New("Per-app VPN requires device management on iOS"))}
        if mode,_:=s["splitMode"].(string);mode=="include"{return failure(errors.New("Per-app VPN requires device management on iOS"))}
    }
    response:=c.backend.Call(channel,args)
    if channel!="connect" {return response}
    var result struct{OK bool `json:"ok"`};json.Unmarshal([]byte(response),&result)
    if !result.OK{return response}
    c.engineMu.Lock();defer c.engineMu.Unlock()
    var state map[string]any;json.Unmarshal([]byte(c.Snapshot()),&state)
    if state["connection"]!="connecting" {return failure(errors.New("Connection cancelled"))}
    var config map[string]any;json.Unmarshal([]byte(c.backend.EngineConfig()),&config)
    for _,raw:=range config["inbounds"].([]any){inbound:=raw.(map[string]any);delete(inbound,"exclude_package");delete(inbound,"include_package");inbound["stack"]="gvisor"}
    data,_:=json.Marshal(config)
    service,err:=libbox.NewService(string(data),&platform{client:c})
    if err==nil{c.engine=service;err=service.Start()}
    if err!=nil {if c.engine!=nil{c.engine.Close();c.engine=nil};c.backend.Failed("VPN engine could not start: "+err.Error());return failure(err)}
    c.backend.Ready()
    return `{"ok":true,"data":null}`
}
func(c *Client) Stop(){c.backend.Disconnect();c.engineMu.Lock();if c.engine!=nil{c.engine.Close();c.engine=nil};c.engineMu.Unlock()}
func(c *Client) UpdatePath(value string){
    var state pathState;if json.Unmarshal([]byte(value),&state)!=nil{return}
    c.pathMu.Lock();c.path=state;listener:=c.listener;c.pathMu.Unlock()
    if listener!=nil{listener.UpdateDefaultInterface(state.Name,state.Index,state.Expensive,state.Constrained)}
}
type platform struct{client *Client}
func(p *platform) LocalDNSTransport()libbox.LocalDNSTransport{return nil}
func(p *platform) UsePlatformAutoDetectInterfaceControl()bool{return false}
func(p *platform) AutoDetectInterfaceControl(fd int32)error{return nil}
func(p *platform) OpenTun(options libbox.TunOptions)(int32,error){
    read:=func(it libbox.RoutePrefixIterator)[]map[string]any{items:=[]map[string]any{};for it.HasNext(){p:=it.Next();items=append(items,map[string]any{"address":p.Address(),"prefix":p.Prefix(),"mask":p.Mask()})};return items}
    dns,err:=options.GetDNSServerAddress();if err!=nil{return -1,err}
    plan:=map[string]any{"ipv4":read(options.GetInet4Address()),"ipv6":read(options.GetInet6Address()),"routes4":read(options.GetInet4RouteRange()),"routes6":read(options.GetInet6RouteRange()),"dns":dns.Value,"mtu":options.GetMTU()}
    data,_:=json.Marshal(plan);fd:=p.client.host.OpenTun(string(data));if fd<0{return fd,errors.New("iOS could not configure the packet tunnel")};return fd,nil
}
func(p *platform) WriteLog(message string){}
func(p *platform) UseProcFS()bool{return false}
func(p *platform) FindConnectionOwner(protocol int32,source string,sourcePort int32,destination string,destinationPort int32)(int32,error){return -1,errors.New("Process routing is unavailable on iOS")}
func(p *platform) PackageNameByUid(uid int32)(string,error){return "",nil}
func(p *platform) UIDByPackageName(name string)(int32,error){return -1,errors.New("Per-app VPN requires device management")}
func(p *platform) StartDefaultInterfaceMonitor(listener libbox.InterfaceUpdateListener)error{p.client.pathMu.Lock();p.client.listener=listener;state:=p.client.path;p.client.pathMu.Unlock();listener.UpdateDefaultInterface(state.Name,state.Index,state.Expensive,state.Constrained);return nil}
func(p *platform) CloseDefaultInterfaceMonitor(listener libbox.InterfaceUpdateListener)error{p.client.pathMu.Lock();p.client.listener=nil;p.client.pathMu.Unlock();return nil}
func(p *platform) GetInterfaces()(libbox.NetworkInterfaceIterator,error){
    values,err:=net.Interfaces();if err!=nil{return nil,err};result:=&interfaces{}
    for _,v:=range values {if v.Flags&net.FlagUp==0{continue};addresses,e:=v.Addrs();if e!=nil{continue};a:=&stringsIterator{};for _,address:=range addresses{a.items=append(a.items,address.String())}
    flags:=int32(syscall.IFF_UP);if v.Flags&net.FlagLoopback!=0{flags|=syscall.IFF_LOOPBACK};if v.Flags&net.FlagPointToPoint!=0{flags|=syscall.IFF_POINTOPOINT};if v.Flags&net.FlagMulticast!=0{flags|=syscall.IFF_MULTICAST}
    kind:=libbox.InterfaceTypeOther;if strings.HasPrefix(v.Name,"en"){kind=libbox.InterfaceTypeWIFI};if strings.HasPrefix(v.Name,"pdp_ip"){kind=libbox.InterfaceTypeCellular}
    result.items=append(result.items,&libbox.NetworkInterface{Index:int32(v.Index),MTU:int32(v.MTU),Name:v.Name,Addresses:a,Flags:flags,Type:kind,DNSServer:&stringsIterator{}})
    };return result,nil
}
func(p *platform) UnderNetworkExtension()bool{return true}
func(p *platform) IncludeAllNetworks()bool{return false}
func(p *platform) ReadWIFIState()*libbox.WIFIState{return nil}
func(p *platform) SystemCertificates()libbox.StringIterator{return &stringsIterator{}}
func(p *platform) ClearDNSCache(){}
func(p *platform) SendNotification(notification *libbox.Notification)error{return nil}
type interfaces struct{items []*libbox.NetworkInterface;index int}
func(v *interfaces)Next()*libbox.NetworkInterface{if !v.HasNext(){return nil};item:=v.items[v.index];v.index++;return item}
func(v *interfaces)HasNext()bool{return v.index<len(v.items)}
type stringsIterator struct{items []string;index int}
func(v *stringsIterator)Next()string{if !v.HasNext(){return ""};item:=v.items[v.index];v.index++;return item}
func(v *stringsIterator)HasNext()bool{return v.index<len(v.items)}
func(v *stringsIterator)Len()int32{return int32(len(v.items))}
