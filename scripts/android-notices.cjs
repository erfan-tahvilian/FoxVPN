const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),core=path.join(root,'android/core');
const target=path.join(root,'android/app/src/main/assets/third-party/go');
fs.mkdirSync(target,{recursive:true});
const lines=execFileSync('go',['list','-deps','-tags=with_gvisor,with_clash_api,with_conntrack','-f','{{if .Module}}{{.Module.Path}}|{{.Module.Version}}|{{.Module.Dir}}{{end}}','./mobile','github.com/sagernet/sing-box/experimental/libbox'],{cwd:core,encoding:'utf8',maxBuffer:8*1024*1024,env:{...process.env,GOOS:'android',GOARCH:'arm64',CGO_ENABLED:'1'}}).split(/\r?\n/).filter(Boolean);
lines.push(execFileSync('go',['list','-m','-f','{{.Path}}|{{.Version}}|{{.Dir}}','github.com/sagernet/gomobile'],{cwd:core,encoding:'utf8'}).trim());
const seen=new Set(),modules=[];
for(const line of lines){
 const [name,version,directory]=line.split('|');if(!version||seen.has(name))continue;seen.add(name);
 const destination=path.join(target,name+'@'+version);fs.mkdirSync(destination,{recursive:true});
 const files=fs.readdirSync(directory).filter(file=>/^(LICENSE|COPYING|COPYRIGHT|NOTICE)(\.|-|$)/i.test(file));
 for(const file of files)fs.cpSync(path.join(directory,file),path.join(destination,file),{recursive:true});
 if(!files.length)throw Error('Dependency license not found: '+name);
 modules.push({name,version,notices:files});
}
const goroot=execFileSync('go',['env','GOROOT'],{encoding:'utf8'}).trim();
fs.copyFileSync(path.join(goroot,'LICENSE'),path.join(target,'LICENSE-Go.txt'));
fs.writeFileSync(path.join(target,'modules.json'),JSON.stringify(modules.sort((a,b)=>a.name.localeCompare(b.name)),null,2)+'\n');
console.log('Included notices for '+modules.length+' Go modules.');
