require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const OUT_DIR = path.join(__dirname, '..', 'csv-exports');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function csvCell(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') v = JSON.stringify(v);
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function toCsv(rows) {
    if (rows.length === 0) return '';
    const headers = Array.from(rows.reduce((set, r) => {
        Object.keys(r).forEach(k => set.add(k));
        return set;
    }, new Set()));
    const lines = [headers.join(',')];
    for (const r of rows) lines.push(headers.map(h => csvCell(r[h])).join(','));
    return lines.join('\n');
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Collections found:', collections.map(c => c.name).join(', '));

    for (const { name } of collections) {
        const docs = await db.collection(name).find({}).toArray();
        const csv = toCsv(docs.map(d => ({ ...d, _id: String(d._id) })));
        const file = path.join(OUT_DIR, `${name}.csv`);
        fs.writeFileSync(file, csv);
        console.log(`  ${name}: ${docs.length} docs -> ${file}`);
    }

    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
