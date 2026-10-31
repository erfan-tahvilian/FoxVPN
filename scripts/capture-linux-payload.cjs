// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {contents}=require('./verify-distribution.cjs'),{target,outputRoot}=require('./linux-target.cjs');
module.exports=async context=>{
  assert.equal(process.platform,'linux');assert.equal(path.resolve(context.appOutDir),outputRoot());
  fs.mkdirSync('.tools',{recursive:true});
  fs.writeFileSync(`.tools/linux-payload-${target().arch}.json`,JSON.stringify({root:context.appOutDir,entries:contents(context.appOutDir)}));
};
