import hashlib
import io
import struct
import tempfile
import unittest
from pathlib import Path

from pck import Pack, decode_texture, safe_path


def pack_bytes(version=3, name='Fgo/localization/eng/cards.json', payload=b'{}'):
    encoded = name.encode()
    entry = struct.pack('<I', len(encoded)) + encoded + struct.pack('<QQ', 0, len(payload))
    entry += hashlib.md5(payload).digest() + struct.pack('<I', 0)
    if version == 3:
        header = b'GDPC' + struct.pack('<5IQQ', 3, 4, 5, 1, 2, 40, 40 + len(payload))
        return header + payload + struct.pack('<I', 1) + entry
    base = 100 + len(entry)
    header = b'GDPC' + struct.pack('<5IQ', 2, 4, 4, 0, 0, base) + bytes(64)
    return header + struct.pack('<I', 1) + entry + payload


class PackTests(unittest.TestCase):
    def read_pack(self, data):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        path = Path(temp.name) / 'test.pck'
        path.write_bytes(data)
        return Pack(path)

    def test_both_directory_formats(self):
        for version in (2, 3):
            pack = self.read_pack(pack_bytes(version))
            self.assertEqual(pack.read('res://Fgo/localization/eng/cards.json'), b'{}')

    def test_rejects_traversal_and_drive_paths(self):
        for name in ('../secret', '/absolute', 'C:/file', 'a\\b', 'a/../b', 'a//b'):
            with self.assertRaises(ValueError):
                safe_path(name)

    def test_checksum_and_truncation(self):
        pack = self.read_pack(pack_bytes(payload=b'{}'))
        pack.path.write_bytes(pack.path.read_bytes().replace(b'{}', b'[]'))
        with self.assertRaisesRegex(ValueError, 'checksum'):
            pack.read('Fgo/localization/eng/cards.json')
        with self.assertRaises(ValueError):
            self.read_pack(pack_bytes()[:-10])

    def test_decode_texture_first_mip(self):
        from PIL import Image
        buffer = io.BytesIO()
        Image.new('RGBA', (3, 2), (12, 34, 56, 255)).save(buffer, 'WEBP', lossless=True)
        encoded = buffer.getvalue()
        data = b'GST2' + struct.pack('<8I', 1, 3, 2, 0, 0, 0, 0, 0)
        data += struct.pack('<IHHIII', 2, 3, 2, 0, 5, len(encoded)) + encoded
        with Image.open(io.BytesIO(decode_texture(data))) as image:
            self.assertEqual(image.size, (3, 2))
            self.assertEqual(image.convert('RGBA').getpixel((0, 0)), (12, 34, 56, 255))
        with self.assertRaises(ValueError):
            decode_texture(data[:60])


if __name__ == '__main__':
    unittest.main()
