// SPDX-License-Identifier: GPL-3.0-or-later
// Round-trip distribution packages and compare the complete application payload.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const version=require('../package.json').version,distribution=path.resolve(process.argv[2]||'dist');
function contents(root){
  const result={};
  function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
    const file=path.join(folder,entry.name),name=path.relative(root,file).split(path.sep).join('/'),stat=fs.lstatSync(file);
    if(stat.isSymbolicLink())result[name]={link:fs.readlinkSync(file)};
    else if(stat.isDirectory())walk(file);
    else if(stat.isFile())result[name]={sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),executable:process.platform==='win32'?false:Boolean(stat.mode&0o111)};
    else throw Error('Unsupported payload entry: '+name);
  }}walk(root);return result;
}
async function main(){
  const targets={win32:'windows',darwin:'mac',linux:'linux'},platform=targets[process.platform];assert(platform,'Unsupported distribution host');
  const t=require(`./${platform}-target.cjs`),target=t.target(),results=[];
  let expected;
  if(platform==='linux'){
    // FPM adds DEB/RPM-only AppArmor and updater metadata to appOutDir after
    // AppImage creation. Compare the application snapshot taken before targets.
    const snapshot=JSON.parse(fs.readFileSync(`.tools/linux-payload-${target.arch}.json`,'utf8'));
    assert.equal(path.resolve(snapshot.root),t.outputRoot());expected=snapshot.entries;
  }else expected=contents(t.outputRoot());
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'fox-distribution-'));
  const verify=(folder,file)=>{const actual=contents(folder);for(const [name,value]of Object.entries(expected))assert.deepEqual(actual[name],value,`Distribution changed or omitted ${name}`);results.push({file:path.basename(file),bytes:fs.statSync(file).size,verifiedEntries:Object.keys(expected).length});};
  if(process.platform==='win32'){
    const seven=await require('app-builder-lib/out/toolsets/7zip').getPath7za(),installer=path.join(distribution,`FoxVPN-${version}-Windows-${target.label}.exe`),payload=path.join(temporary,'payload');
    // The builder's standalone 7za reads the embedded application archive
    // directly; it does not decode the outer NSIS plugin/uninstaller streams.
    execFileSync(seven,['x','-t7z',installer,`-o${payload}`,'-y'],{stdio:'pipe'});verify(payload,installer);
    const zip=path.join(distribution,`FoxVPN-${version}-Windows-${target.label}.zip`),portable=path.join(temporary,'portable');
    execFileSync(seven,['x','-tzip',zip,`-o${portable}`,'-y'],{stdio:'pipe'});verify(portable,zip);
  }else if(process.platform==='darwin'){
    const dmg=path.join(distribution,`FoxVPN-${version}-macOS-${target.arch}.dmg`),mount=path.join(temporary,'mount');fs.mkdirSync(mount);
    execFileSync('/usr/bin/hdiutil',['attach',dmg,'-nobrowse','-readonly','-mountpoint',mount],{stdio:'pipe'});
    try{verify(path.join(mount,'Fox VPN.app'),dmg);}finally{execFileSync('/usr/bin/hdiutil',['detach',mount],{stdio:'pipe'});}
    const zip=path.join(distribution,`FoxVPN-${version}-macOS-${target.arch}.zip`),unzip=path.join(temporary,'zip');
    execFileSync('/usr/bin/ditto',['-x','-k',zip,unzip],{stdio:'pipe'});verify(path.join(unzip,'Fox VPN.app'),zip);
  }else{
    const image=path.join(distribution,`FoxVPN-${version}-Linux-${target.arch}.AppImage`);
    execFileSync(image,['--appimage-extract'],{cwd:temporary,stdio:'pipe',maxBuffer:16*1024*1024});verify(path.join(temporary,'squashfs-root'),image);
    for(const format of ['deb','rpm']){
      const file=path.join(distribution,`FoxVPN-${version}-Linux-${target.arch}.${format}`),unpacked=path.join(temporary,format);fs.mkdirSync(unpacked);
      if(format==='deb')execFileSync('dpkg-deb',['--extract',file,unpacked],{stdio:'pipe'});
      else{
        const cpio=path.join(temporary,'payload.cpio'),output=fs.openSync(cpio,'w');
        try{execFileSync('rpm2cpio',[file],{stdio:['ignore',output,'pipe']});}finally{fs.closeSync(output);}
        const input=fs.openSync(cpio,'r');
        try{execFileSync('cpio',['-idm','--quiet','--no-absolute-filenames'],{cwd:unpacked,stdio:[input,'pipe','pipe']});}finally{fs.closeSync(input);}
      }
      const opt=path.join(unpacked,'opt'),apps=fs.readdirSync(opt).map(name=>path.join(opt,name)).filter(folder=>fs.existsSync(path.join(folder,'resources/app.asar')));
      assert.equal(apps.length,1,'Expected exactly one application in the package');verify(apps[0],file);
    }
  }
  fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync(`test-results/package-roundtrip-${platform}-${target.arch}.json`,JSON.stringify({version,platform,arch:target.arch,results},null,2));
  console.log(`Verified complete payload, symlinks and executable permissions after extracting ${results.length} distribution package(s).`);
  console.log(JSON.stringify({version,platform,arch:target.arch,results}));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={contents};
