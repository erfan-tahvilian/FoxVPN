// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import (
 "context"
 "encoding/json"
 "errors"
 "net/http"
 "regexp"
 "strconv"
 "strings"
 "sync"
 "time"
)

const appVersion = "1.0.1"
var stableVersion=regexp.MustCompile(`^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$`)
var updateDigest=regexp.MustCompile(`^sha256:[a-f0-9]{64}$`)
type releaseUpdates struct { mu sync.Mutex; checked time.Time; arch,etag string; raw []byte }
func newerVersion(candidate,current string)(bool,error){
 if !stableVersion.MatchString(candidate)||!stableVersion.MatchString(current){return false,errors.New("Invalid release version")}
 a,b:=strings.Split(candidate,"."),strings.Split(current,".")
 for i:=range a {x,_:=strconv.Atoi(a[i]);y,_:=strconv.Atoi(b[i]);if x!=y{return x>y,nil}}
 return false,nil
}
func selectAndroidRelease(raw []byte,current,arch string)(object,error){
 switch arch {case "arm64-v8a","armeabi-v7a","x86_64","x86","universal":default:return nil,errors.New("Unsupported Android architecture")}
 var release struct {Tag string `json:"tag_name"`;Draft bool `json:"draft"`;Prerelease bool `json:"prerelease"`;Assets []struct{Name string `json:"name"`;URL string `json:"browser_download_url"`;State string `json:"state"`;Size int64 `json:"size"`;Digest string `json:"digest"`} `json:"assets"`}
 if json.Unmarshal(raw,&release)!=nil{return nil,errors.New("Invalid update response")}
 version:=strings.TrimPrefix(release.Tag,"v")
 available,err:=newerVersion(version,current)
 if err!=nil||release.Tag!="v"+version||release.Draft||release.Prerelease{return nil,errors.New("The latest stable release is unavailable")}
 result:=object{"available":false,"currentVersion":current,"latestVersion":version}
 if !available{return result,nil}
 name:="FoxVPN-"+version+"-Android-"+arch+".apk"
 url:="https://github.com/erfan-tahvilian/FoxVPN/releases/download/"+release.Tag+"/"+name
 for _,asset:=range release.Assets {
  if asset.Name==name&&asset.URL==url&&asset.State=="uploaded"&&asset.Size>0&&updateDigest.MatchString(asset.Digest){
   return object{"available":true,"currentVersion":current,"latestVersion":version,"name":name,"url":url,"size":asset.Size,"sha256":strings.TrimPrefix(asset.Digest,"sha256:")},nil
  }
 }
 return nil,errors.New("The matching update package is not available yet")
}
func (b *Backend) checkUpdates(ctx context.Context,arch string,force bool)(object,error){
 u:=&b.updates;u.mu.Lock();defer u.mu.Unlock()
 if !force&&u.arch==arch&&len(u.raw)>0&&time.Since(u.checked)>=0&&time.Since(u.checked)<6*time.Hour {return selectAndroidRelease(u.raw,appVersion,arch)}
 ctx,cancel:=context.WithTimeout(ctx,12*time.Second);defer cancel()
 headers:=http.Header{"Accept":[]string{"application/vnd.github+json"},"User-Agent":[]string{"FoxVPN/"+appVersion},"X-GitHub-Api-Version":[]string{"2022-11-28"}}
 if u.etag!="" {headers.Set("If-None-Match",u.etag)}
 raw,h,status,err:=b.fetch(ctx,"https://api.github.com/repos/erfan-tahvilian/FoxVPN/releases/latest","GET",nil,headers)
 if err!=nil{return nil,errors.New("Could not check for updates. Try again later")}
 if status==http.StatusNotModified&&len(u.raw)>0 {raw=u.raw} else if status!=http.StatusOK {return nil,errors.New("Could not check for updates. Try again later")}
 if len(raw)>1024*1024{return nil,errors.New("Invalid update response")}
 result,err:=selectAndroidRelease(raw,appVersion,arch);if err!=nil{return nil,err}
 u.raw=raw;u.arch=arch;u.checked=time.Now();if tag:=h.Get("ETag");tag!="" {u.etag=tag}
 return result,nil
}
