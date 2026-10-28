// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import (
 "encoding/json"
 "errors"
 "regexp"
 "strings"
)

const accountAgent = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36"

var challengeCall = regexp.MustCompile(`\binit\s*\(\s*\[`)

// Decode JSON arguments without interpreting or running remote JavaScript.
func parseChallengeInit(script, prefix string) ([]object, string, error) {
 if len(script) > 2*1024*1024 { return nil, "", errors.New("Service verification response is too large") }
 calls := challengeCall.FindAllStringIndex(script, -1)
 for i := len(calls)-1; i>=0; i-- {
  rest := script[calls[i][1]-1:]
  var values [3]json.RawMessage
  valid := true
  for n := range values {
   decoder := json.NewDecoder(strings.NewReader(rest))
   if decoder.Decode(&values[n]) != nil { valid=false; break }
   rest = strings.TrimSpace(rest[decoder.InputOffset():])
   if n<2 {
    if !strings.HasPrefix(rest, ",") { valid=false; break }
    rest = strings.TrimSpace(rest[1:])
   }
  }
  if !valid || ( !strings.HasPrefix(rest, ",") && !strings.HasPrefix(rest, ")") ) { continue }
  var challenges []object
  var token, path string
  if json.Unmarshal(values[0], &challenges)!=nil || json.Unmarshal(values[1], &token)!=nil || json.Unmarshal(values[2], &path)!=nil || len(challenges)==0 || token=="" || path!=prefix { continue }
  for _, c := range challenges { if str(c,"ty")=="" { valid=false } }
  if valid { return challenges, token, nil }
 }
 return nil,"",errors.New("The service challenge format changed. Try again later")
}
