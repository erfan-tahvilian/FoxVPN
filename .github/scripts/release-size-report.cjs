// SPDX-License-Identifier: GPL-3.0-or-later
// Extend the reusable package comparison with a release-asset inventory.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {binaries}=require('./release-tools.cjs');
const {compare:packageComparison,report:packageReport}=require('../../scripts/release-size-report.cjs');
function compare(before,after){
  const result=packageComparison(before,after),oldPackages=new Set(binaries(before.tag_name.replace(/^v/,'')));
  result.auxiliary=before.assets.filter(a=>!oldPackages.has(a.name)).map(old=>{
    const next=after.assets.find(a=>a.name===old.name);
    return {name:old.name,status:next?'retained':'retired',previousBytes:old.size,finalBytes:next?.size||0,savedBytes:old.size-(next?.size||0)};
  });
  result.releaseTotals={previousBytes:before.assets.reduce((s,a)=>s+a.size,0),finalBytes:after.assets.reduce((s,a)=>s+a.size,0)};
  result.releaseTotals.savedBytes=result.releaseTotals.previousBytes-result.releaseTotals.finalBytes;
  return result;
}
function report(result){
  const number=n=>n.toLocaleString('en-US'),mib=n=>(n/1048576).toFixed(2);
  return packageReport(result)+`\n## Source and checksum assets\n\n| Asset | Decision | Initial bytes | Final bytes | Saved bytes | Reduction |\n| --- | --- | ---: | ---: | ---: | ---: |\n`+
    result.auxiliary.map(r=>`| ${r.name} | ${r.status} | ${number(r.previousBytes)} | ${number(r.finalBytes)} | ${number(r.savedBytes)} | ${(r.savedBytes/r.previousBytes*100).toFixed(3)}% |`).join('\n')+
    `\n\n**Total release assets:** ${number(result.releaseTotals.previousBytes)} -> ${number(result.releaseTotals.finalBytes)} bytes; **${number(result.releaseTotals.savedBytes)} bytes (${mib(result.releaseTotals.savedBytes)} MiB, ${(result.releaseTotals.savedBytes/result.releaseTotals.previousBytes*100).toFixed(3)}%)** saved, including the retired duplicate source archive.\n`;
}
if(require.main===module){
  const [beforeFile,afterFile,output]=process.argv.slice(2);assert(beforeFile&&afterFile&&output);
  const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')),result=compare(read(beforeFile),read(afterFile));
  fs.writeFileSync(output,report(result));fs.writeFileSync(output.replace(/\.md$/,'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({packages:result.totals,allAssets:result.releaseTotals}));
}
module.exports={compare,report};
