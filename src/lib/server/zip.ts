import { deflateRawSync } from 'zlib';

/* Escritor mínimo de ZIP (formato PKZIP) em memória, sem dependências externas.
   Suporta apenas compressão DEFLATE (via zlib). Suficiente para gerar o
   pacote .zip dos XMLs do mês. */

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

type ZipEntry = { name: string; data: Buffer };

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const EOCD = 0x06054b50;

export function buildZip(files: ZipEntry[]): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    const central: { offset: number; crc: number; size: number; compSize: number }[] = [];

    for (const file of files) {
        // Guarda contra path traversal no nome dentro do zip.
        const name = file.name.replace(/\\/g, '/').replace(/^\/+/, '');
        const crc = crc32(file.data);
        const comp = deflateRawSync(file.data);
        const offset = localParts.reduce((a, p) => a + p.length, 0);

        const nameBuf = Buffer.from(name, 'utf8');
        const local = Buffer.alloc(30);
        local.writeUInt32LE(LOCAL_HEADER, 0);
        local.writeUInt16LE(20, 4); // version needed
        local.writeUInt16LE(0x0800, 6); // flags: UTF-8
        local.writeUInt16LE(8, 8); // method: deflate
        local.writeUInt16LE(0, 10);
        local.writeUInt16LE(0, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(comp.length, 18);
        local.writeUInt32LE(file.data.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        local.writeUInt16LE(0, 28);
        localParts.push(local, nameBuf, comp);

        const centralHead = Buffer.alloc(46);
        centralHead.writeUInt32LE(CENTRAL_HEADER, 0);
        centralHead.writeUInt16LE(20, 4); // version made by
        centralHead.writeUInt16LE(20, 6);
        centralHead.writeUInt16LE(0x0800, 8);
        centralHead.writeUInt16LE(8, 10);
        centralHead.writeUInt16LE(0, 12);
        centralHead.writeUInt16LE(0, 14);
        centralHead.writeUInt32LE(crc, 16);
        centralHead.writeUInt32LE(comp.length, 20);
        centralHead.writeUInt32LE(file.data.length, 24);
        centralHead.writeUInt16LE(nameBuf.length, 28);
        centralHead.writeUInt16LE(0, 30);
        centralHead.writeUInt16LE(0, 32);
        centralHead.writeUInt16LE(0, 34);
        centralHead.writeUInt16LE(0, 36);
        centralHead.writeUInt32LE(0, 38); // external attrs
        centralHead.writeUInt32LE(offset, 42);
        centralParts.push(centralHead, nameBuf);
        central.push({ offset, crc, size: file.data.length, compSize: comp.length });
    }

    const centralStart = localParts.reduce((a, p) => a + p.length, 0);
    const allCentral = Buffer.concat(centralParts);

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(EOCD, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(files.length, 8);
    eocd.writeUInt16LE(files.length, 10);
    eocd.writeUInt32LE(allCentral.length, 12);
    eocd.writeUInt32LE(centralStart, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, allCentral, eocd]);
}
