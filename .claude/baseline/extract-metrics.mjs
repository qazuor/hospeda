import { readFileSync, writeFileSync } from 'node:fs';

const dir = '/home/qazuor/projects/WEBS/hospeda-home-audit/.claude/baseline/lighthouse';
const out = {};
for (const locale of ['es', 'en', 'pt']) {
    const j = JSON.parse(readFileSync(`${dir}/${locale}.json`, 'utf8'));
    const a = j.audits || {};
    out[locale] = {
        LCP_ms: a['largest-contentful-paint']?.numericValue,
        LCP_display: a['largest-contentful-paint']?.displayValue,
        CLS: a['cumulative-layout-shift']?.numericValue,
        CLS_display: a['cumulative-layout-shift']?.displayValue,
        FCP_display: a['first-contentful-paint']?.displayValue,
        TBT_display: a['total-blocking-time']?.displayValue,
        SI_display: a['speed-index']?.displayValue,
        perfScore: j.categories?.performance?.score,
        fetchTime: j.fetchTime
    };
}
console.log(JSON.stringify(out, null, 2));
writeFileSync(`${dir}/metrics.json`, JSON.stringify(out, null, 2));
