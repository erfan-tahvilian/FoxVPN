// SPDX-License-Identifier: GPL-3.0-or-later
function allowanceSummary(quota) {
  if(quota?.unlimited===true)return {kind:'unlimited'};
  const number=value=>value==null||String(value).trim()===''?null:Number(value);
  const limit=number(quota?.limit),remaining=number(quota?.remaining);
  if(!Number.isFinite(limit)||limit<=0||!Number.isFinite(remaining)||remaining<0)return {kind:'unknown'};
  const left=Math.min(limit,remaining),used=limit-left;
  const raw=quota?.reset;let reset=null;
  if(raw!=null&&String(raw).trim()!==''){
    const numeric=Number(raw),date=new Date(Number.isFinite(numeric)?numeric*(numeric<1e12?1000:1):raw);
    if(Number.isFinite(date.getTime())&&date.getTime()>Date.now())reset=date;
  }
  return {kind:'limited',limit,remaining:left,used,percent:Math.round(used/limit*100),reset};
}
if(typeof module!=='undefined')module.exports={allowanceSummary};
