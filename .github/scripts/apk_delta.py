# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Erfan Tahvilian
"""Reproduce locally signed APKs from verified CI outputs without transferring their payloads."""
import hashlib
import json
import pathlib
import struct
import sys
import zipfile

ARCHES = ('arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86', 'universal')


def digest(file):
    with open(file, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def payload_offset(stream, entry):
    stream.seek(entry.header_offset)
    header = stream.read(30)
    if header[:4] != b'PK\x03\x04':
        raise ValueError('Invalid ZIP local header')
    name, extra = struct.unpack_from('<HH', header, 26)
    return entry.header_offset + 30 + name + extra


def create(unsigned_root, signed_root, output, run_id, commit):
    manifest = {'format': 1, 'run_id': str(run_id), 'commit': commit, 'packages': []}
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as patch:
        for arch in ARCHES:
            candidates = list(pathlib.Path(unsigned_root).rglob(f'app-{arch}-release-unsigned.apk'))
            if len(candidates) != 1:
                raise ValueError(f'Missing unsigned {arch} package')
            source = candidates[0]
            name = f'FoxVPN-1.0.0-Android-{arch}.apk'
            signed = pathlib.Path(signed_root) / name
            operations, literal = [], bytearray()

            def insert(data):
                if data:
                    operations.append(['literal', len(literal), len(data)])
                    literal.extend(data)

            with zipfile.ZipFile(source) as before, zipfile.ZipFile(signed) as after, open(source, 'rb') as src, open(signed, 'rb') as dst:
                entries = {entry.filename: entry for entry in before.infolist()}
                cursor = 0
                for entry in sorted(after.infolist(), key=lambda entry: entry.header_offset):
                    offset = payload_offset(dst, entry)
                    dst.seek(cursor)
                    insert(dst.read(offset - cursor))
                    dst.seek(offset)
                    data = dst.read(entry.compress_size)
                    original = entries.get(entry.filename)
                    copied = False
                    if original and original.compress_size == entry.compress_size and original.CRC == entry.CRC:
                        position = payload_offset(src, original)
                        src.seek(position)
                        if src.read(original.compress_size) == data:
                            operations.append(['copy', position, len(data)])
                            copied = True
                    if not copied:
                        insert(data)
                    cursor = offset + entry.compress_size
                dst.seek(cursor)
                insert(dst.read())
            if len(literal) > 2 * 1024 * 1024:
                raise ValueError('Unexpected APK rewrite; refusing a large signature patch')
            patch.writestr(arch + '.bin', literal)
            manifest['packages'].append({'arch': arch, 'name': name, 'unsigned_sha256': digest(source), 'signed_sha256': digest(signed), 'size': signed.stat().st_size, 'operations': operations})
        patch.writestr('manifest.json', json.dumps(manifest, separators=(',', ':')))


def apply(unsigned_root, patch_file, output, run_id, commit):
    output = pathlib.Path(output)
    output.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(patch_file) as patch:
        if sum(entry.file_size for entry in patch.infolist()) > 12 * 1024 * 1024:
            raise ValueError('Signature patch is too large')
        manifest = json.loads(patch.read('manifest.json'))
        if manifest['format'] != 1 or manifest['run_id'] != str(run_id) or manifest['commit'] != commit:
            raise ValueError('Source build identity mismatch')
        if sorted(package['arch'] for package in manifest['packages']) != sorted(ARCHES):
            raise ValueError('Unexpected architecture list')
        for package in manifest['packages']:
            arch = package['arch']
            if package['name'] != f'FoxVPN-1.0.0-Android-{arch}.apk':
                raise ValueError('Unexpected output name')
            candidates = list(pathlib.Path(unsigned_root).rglob(f'app-{arch}-release-unsigned.apk'))
            if len(candidates) != 1 or digest(candidates[0]) != package['unsigned_sha256']:
                raise ValueError('Unsigned package hash mismatch')
            source = candidates[0]
            literal = patch.read(arch + '.bin')
            destination = output / package['name']
            written = 0
            with open(source, 'rb') as src, open(destination, 'wb') as dst:
                for kind, offset, length in package['operations']:
                    limit = source.stat().st_size if kind == 'copy' else len(literal)
                    if kind not in ('copy', 'literal') or not isinstance(offset, int) or not isinstance(length, int) or offset < 0 or length < 0 or offset + length > limit:
                        raise ValueError('Invalid patch range')
                    written += length
                    if written > package['size']:
                        raise ValueError('Invalid output size')
                    if kind == 'literal':
                        dst.write(literal[offset:offset + length])
                    else:
                        src.seek(offset)
                        remaining = length
                        while remaining:
                            data = src.read(min(remaining, 1024 * 1024))
                            if not data:
                                raise ValueError('Unexpected end of source')
                            dst.write(data)
                            remaining -= len(data)
            if written != package['size'] or digest(destination) != package['signed_sha256']:
                raise ValueError('Signed package hash mismatch')
            print(f'Verified signed APK: {package["name"]}', flush=True)


if __name__ == '__main__':
    if sys.argv[1] == 'create':
        create(*sys.argv[2:])
    elif sys.argv[1] == 'apply':
        apply(*sys.argv[2:])
    else:
        raise SystemExit('Use create or apply')
