// SPDX-License-Identifier: GPL-3.0-or-later
const test=require('node:test'),assert=require('node:assert/strict');
const {allowanceSummary}=require('../src/ui/usage.js');
test('monthly allowance preserves zero remaining and clamps reported usage',()=>{
  assert.deepEqual(allowanceSummary({limit:'1000',remaining:'0'}),{kind:'limited',limit:1000,remaining:0,used:1000,percent:100,reset:null});
  assert.equal(allowanceSummary({limit:1000,remaining:730}).percent,27);
  assert.equal(allowanceSummary({limit:1000,remaining:2000}).used,0);
});
test('missing allowance is not presented as zero usage or unlimited',()=>{
  for(const q of [null,{}, {limit:'',remaining:'0'},{limit:0,remaining:0},{limit:1000,remaining:null},{limit:1000,remaining:-1},{limit:'invalid',remaining:10}])assert.equal(allowanceSummary(q).kind,'unknown');
  assert.equal(allowanceSummary({unlimited:true}).kind,'unlimited');
});
test('allowance reset dates accept epoch seconds or ISO dates without inventing missing dates',()=>{
  const next=Date.now()+86400000;
  assert.equal(allowanceSummary({limit:1000,remaining:730,reset:Math.floor(next/1000)}).reset.getTime(),Math.floor(next/1000)*1000);
  assert.equal(allowanceSummary({limit:1000,remaining:730,reset:new Date(next).toISOString()}).reset.getTime(),next);
  for(const reset of ['',null,'invalid',1])assert.equal(allowanceSummary({limit:1000,remaining:730,reset}).reset,null);
});
