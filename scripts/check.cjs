const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
function check(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())check(file);else if(/\.(cjs|js)$/.test(file))execFileSync(process.execPath,['--check',file],{stdio:'inherit'});}}
check('src');check('scripts');console.log('JavaScript syntax checks passed.');
