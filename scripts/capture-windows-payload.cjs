// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {contents}=require('./verify-distribution.cjs'),{target,outputRoot}=require('./windows-target.cjs');
module.exports=async context=>{
  assert.equal(process.platform,'win32');assert.equal(path.resolve(context.appOutDir),outputRoot());
  // NSIS adds its elevation helper after the portable ZIP is created. Record
  // every original app entry before format-specific targets add their metadata.
  // Verification uses final hashes so future signing remains supported.
  fs.mkdirSync('.tools',{recursive:true});
  fs.writeFileSync(`.tools/windows-payload-${target().arch}.json`,JSON.stringify({root:context.appOutDir,names:Object.keys(contents(context.appOutDir))}));
};
