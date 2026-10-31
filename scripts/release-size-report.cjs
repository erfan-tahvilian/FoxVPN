// SPDX-License-Identifier: GPL-3.0-or-later
// Read-only release comparison. Inputs are saved GitHub API JSON, never binaries.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {binaries}=require('../.github/scripts/release-tools.cjs');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
function compare(before,after){
  const previous=before.tag_name.replace(/^v/,''),current=after.tag_name.replace(/^v/,'');
  const rows=binaries(current).map(name=>{
    const oldName=name.replace(`FoxVPN-${current}-`,`FoxVPN-${previous}-`),old=before.assets.find(a=>a.name===oldName),next=after.assets.find(a=>a.name===name);
    assert(old&&next,`Missing comparable asset: ${name}`);
    const saved=old.size-next.size;
    return {name,previousBytes:old.size,finalBytes:next.size,savedBytes:saved,reductionPercent:saved/old.size*100,sha256:next.digest};
  });
  return {from:before.tag_name,to:after.tag_name,rows,totals:rows.reduce((s,r)=>({previousBytes:s.previousBytes+r.previousBytes,finalBytes:s.finalBytes+r.finalBytes,savedBytes:s.savedBytes+r.savedBytes}),{previousBytes:0,finalBytes:0,savedBytes:0})};
}
function report(result){
  const mib=bytes=>(bytes/1048576).toFixed(2),signed=number=>number>=0?number.toLocaleString('en-US'):`-${(-number).toLocaleString('en-US')}`;
  return `# Fox VPN ${result.to} download-size comparison\n\nBaseline: published ${result.from} packages immediately before this update. All figures are measured from GitHub asset metadata; MiB = 1,048,576 bytes. Positive savings mean a smaller file; negative values explicitly show growth. Changes include version metadata and themed dialogs, so unchanged compression formats may grow slightly.\n\n| Package | Initial bytes | Final bytes | Saved bytes | Initial MiB | Final MiB | Reduction |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n`+
    result.rows.map(r=>`| ${r.name} | ${r.previousBytes.toLocaleString('en-US')} | ${r.finalBytes.toLocaleString('en-US')} | ${signed(r.savedBytes)} | ${mib(r.previousBytes)} | ${mib(r.finalBytes)} | ${r.reductionPercent.toFixed(3)}% |`).join('\n')+
    `\n\n**All 21 application packages:** ${result.totals.previousBytes.toLocaleString('en-US')} -> ${result.totals.finalBytes.toLocaleString('en-US')} bytes. Net download savings: **${signed(result.totals.savedBytes)} bytes (${mib(result.totals.savedBytes)} MiB, ${(result.totals.savedBytes/result.totals.previousBytes*100).toFixed(3)}%)**. This total describes one copy of every architecture/format, not one user's download.\n\nThe separately uploaded FoxVPN source archive is retired after source-content verification. GitHub's native tag archives remain available. sing-box source and both checksum manifests are retained; see [the asset and dependency audit](v1.0.2-asset-audit.md) and [corresponding source](../../SOURCES.md).\n`;
}
if(require.main===module){
  const [beforeFile,afterFile,output]=process.argv.slice(2);assert(beforeFile&&afterFile&&output,'Expected baseline JSON, final JSON and output Markdown');
  const result=compare(read(beforeFile),read(afterFile));fs.writeFileSync(output,report(result));fs.writeFileSync(output.replace(/\.md$/,'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.totals));
}
module.exports={compare,report};
