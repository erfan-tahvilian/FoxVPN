"""Generate localhost-only TLS fixtures. Keys are test data, never used by the app."""
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from datetime import datetime, timezone
from pathlib import Path
import ipaddress
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Fox VPN localhost TEST ONLY')])
cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
        .public_key(key.public_key()).serial_number(x509.random_serial_number())
        .not_valid_before(datetime(2020, 1, 1, tzinfo=timezone.utc))
        .not_valid_after(datetime(2040, 1, 1, tzinfo=timezone.utc))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost'), x509.IPAddress(ipaddress.ip_address('127.0.0.1'))]), critical=False)
        .sign(key, hashes.SHA256()))
directory = Path('tests/fixtures')
directory.mkdir(parents=True, exist_ok=True)
(directory / 'localhost-cert.pem').write_bytes(cert.public_bytes(serialization.Encoding.PEM))
(directory / 'localhost-test-key.pem').write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
