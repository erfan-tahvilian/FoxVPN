# SPDX-License-Identifier: GPL-3.0-or-later
import copy, datetime as dt, importlib.util, unittest, uuid
from pathlib import Path
spec=importlib.util.spec_from_file_location("profiles",Path(__file__).with_name("ios-profiles.py"))
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)

def fixtures():
    values={}
    for role,suffix in p.SUFFIXES.items():
        e={"application-identifier":"PREFIX.com.example.fox"+suffix,"com.apple.developer.team-identifier":"TEAM",p.GROUPS:["group.example.fox"],"keychain-access-groups":["PREFIX.*"],"get-task-allow":False}
        if role!="widgets":e[p.NETWORK]=["packet-tunnel-provider"]
        values[role]={"UUID":str(uuid.uuid4()),"TeamIdentifier":["TEAM"],"ApplicationIdentifierPrefix":["PREFIX"],"ExpirationDate":dt.datetime.now()+dt.timedelta(days=30),"ProvisionedDevices":["device-a"],"DeveloperCertificates":[b"fixture-public-certificate"],"Entitlements":e}
    return values

class ProfileTests(unittest.TestCase):
    def test_valid_profile_and_legacy_prefix(self):
        config=p.validate(fixtures());self.assertEqual(config["keychain"],"com.example.fox.shared");self.assertEqual(config["eligibleDeviceCount"],1)
    def test_free_profile_cannot_silently_drop_vpn(self):
        values=fixtures();del values["tunnel"]["Entitlements"][p.NETWORK]
        with self.assertRaisesRegex(ValueError,"Packet Tunnel"):p.validate(values)
    def test_missing_group_rejected(self):
        values=fixtures();values["widgets"]["Entitlements"][p.GROUPS]=[]
        with self.assertRaisesRegex(ValueError,"App Group"):p.validate(values)
    def test_missing_keychain_rejected(self):
        values=fixtures();values["tunnel"]["Entitlements"]["keychain-access-groups"]=["PREFIX.unrelated"]
        with self.assertRaisesRegex(ValueError,"Keychain"):p.validate(values)
    def test_unregistered_device_rejected(self):
        values=fixtures();values["tunnel"]["ProvisionedDevices"]=["device-b"]
        with self.assertRaisesRegex(ValueError,"registered test device"):p.validate(values)
    def test_expired_profile_rejected(self):
        values=fixtures();values["app"]["ExpirationDate"]=dt.datetime.now()-dt.timedelta(days=1)
        with self.assertRaisesRegex(ValueError,"expired"):p.validate(values)
    def test_wrong_bundle_rejected(self):
        values=fixtures();values["tunnel"]["Entitlements"]["application-identifier"]="PREFIX.com.other.tunnel"
        with self.assertRaisesRegex(ValueError,"bundle identifier"):p.validate(values)
    def test_different_certificate_rejected(self):
        values=fixtures();values["widgets"]["DeveloperCertificates"]=[b"unrelated-certificate"]
        with self.assertRaisesRegex(ValueError,"certificate"):p.validate(values)
    def test_store_profile_not_installable_directly(self):
        values=fixtures();values["app"]["ProvisionedDevices"]=[]
        with self.assertRaisesRegex(ValueError,"registered-device"):p.validate(values)

if __name__=="__main__":unittest.main()
