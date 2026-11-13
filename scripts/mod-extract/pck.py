"""Read standalone Godot 4 PCK v2/v3 without executing the mod.

Format reference: Godot 4.5 core/io/file_access_pack.cpp and
scene/resources/compressed_texture.cpp. Encrypted/sparse packs fail explicitly.
"""
from __future__ import annotations

import hashlib
import io
import struct
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


def safe_path(value: str) -> str:
    value = value.removeprefix('res://')
    path = PurePosixPath(value)
    if not value or '\\' in value or ':' in value or path.is_absolute() or any(
        part in ('', '.', '..') for part in value.split('/')
    ):
        raise ValueError(f'Unsafe resource path: {value!r}')
    return path.as_posix()


@dataclass(frozen=True)
class Entry:
    path: str
    offset: int
    size: int
    md5: str


class Pack:
    def __init__(self, path: Path):
        self.path = path
        self.entries: dict[str, Entry] = {}
        length = path.stat().st_size
        with path.open('rb') as stream:
            def read(size):
                data = stream.read(size)
                if len(data) != size:
                    raise ValueError('Truncated PCK directory')
                return data

            def number(fmt):
                return struct.unpack(fmt, read(struct.calcsize(fmt)))[0]

            if read(4) != b'GDPC':
                raise ValueError('Expected standalone Godot PCK (GDPC)')
            self.version = number('<I')
            self.engine = struct.unpack('<III', read(12))
            flags = number('<I')
            if self.version not in (2, 3) or flags & ~2:
                raise ValueError(f'Unsupported PCK version/flags: {self.version}/{flags}')
            base = number('<Q')
            if self.version == 3:
                directory = number('<Q')
                if directory < 40 or directory >= length:
                    raise ValueError('PCK directory offset out of bounds')
                stream.seek(directory)
            else:
                read(64)
            count = number('<I')
            if count > length // 40:
                raise ValueError('Invalid PCK entry count')
            case_paths: set[str] = set()
            for _ in range(count):
                size = number('<I')
                if size > 65536:
                    raise ValueError('PCK path too long')
                name = safe_path(read(size).rstrip(b'\0').decode('utf-8'))
                offset, size = struct.unpack('<QQ', read(16))
                digest = read(16).hex()
                entry_flags = number('<I')
                if entry_flags:
                    raise ValueError(f'Encrypted/removal entry unsupported: {name}')
                if base + offset > length or size > length - base - offset:
                    raise ValueError(f'PCK entry out of bounds: {name}')
                if name.casefold() in case_paths:
                    raise ValueError(f'Duplicate/case-colliding PCK entry: {name}')
                case_paths.add(name.casefold())
                self.entries[name] = Entry(name, base + offset, size, digest)

    def read(self, name: str) -> bytes:
        entry = self.entries[safe_path(name)]
        with self.path.open('rb') as stream:
            stream.seek(entry.offset)
            data = stream.read(entry.size)
        if len(data) != entry.size or hashlib.md5(data).hexdigest() != entry.md5:
            raise ValueError(f'PCK checksum mismatch: {name}')
        return data


def decode_texture(data: bytes) -> bytes:
    """Return first mip as PNG. Never silently reinterpret GPU compression."""
    from PIL import Image

    if len(data) < 56 or data[:4] != b'GST2':
        raise ValueError('Invalid CompressedTexture2D header')
    version = struct.unpack_from('<I', data, 4)[0]
    encoding, width, height, mipmaps, image_format, size = struct.unpack_from('<IHHIII', data, 36)
    if version > 1 or encoding not in (1, 2):
        raise ValueError(f'Unsupported texture version/encoding {version}/{encoding}')
    if size > len(data) - 56:
        raise ValueError('Truncated texture mip')
    with Image.open(io.BytesIO(data[56:56 + size])) as image:
        if image.size != (width, height):
            raise ValueError('Texture dimensions disagree with mip')
        output = io.BytesIO()
        image.save(output, 'PNG')
        return output.getvalue()
