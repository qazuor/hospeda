"""RN-3 reading (HOS-1352, FASE 1C probe, NOT production code). Read-only: GET each preapproval by id and list its authorized_payments. Never prints the token."""
import json
import os
import urllib.request
import urllib.error
from datetime import datetime, timezone

TOKEN = open(os.path.expanduser("~/.mp-token-hos1352")).read().strip()
IDS = {
    "SUJETO (reactivado)": "04adf298aea54922884c5747b25d2c8b",
    "CONTROL fecha 2": "6b93a2928a0c454397c1a2d4cc956fd6",
    "CONTROL tarjeta": "5d9dfc9d3fe44d8596ef257792246ea0",
}


def get(path):
    req = urllib.request.Request(
        "https://api.mercadopago.com" + path,
        headers={"Authorization": "Bearer " + TOKEN},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


print("leido_en:", datetime.now(timezone.utc).isoformat())
me_status, me = get("/users/me")
print("cuenta:", me_status, me.get("id") if isinstance(me, dict) else me, me.get("tags") if isinstance(me, dict) else "")

for label, pid in IDS.items():
    st, p = get(f"/preapproval/{pid}")
    print(f"\n== {label} {pid} -> HTTP {st}")
    if not isinstance(p, dict):
        print(p)
        continue
    sm = p.get("summarized") or {}
    for k in ("status", "last_modified", "next_payment_date"):
        print(f"  {k}: {p.get(k)}")
    for k in ("charged_quantity", "charged_amount", "last_charged_date", "last_charged_amount", "pending_charge_quantity", "semaphore"):
        print(f"  summarized.{k}: {sm.get(k)}")
    items, offset, total = [], 0, None
    while True:
        st2, res = get(f"/authorized_payments/search?preapproval_id={pid}&limit=10&offset={offset}")
        if st2 != 200 or not isinstance(res, dict):
            print("  authorized_payments search ->", st2, res)
            break
        total = (res.get("paging") or {}).get("total")
        page = res.get("results") or []
        items += page
        offset += 10
        if not page or len(items) >= (total or 0):
            break
    print(f"  authorized_payments: listados={len(items)} total={total}")
    for it in sorted(items, key=lambda x: str(x.get("date_created"))):
        try:
            pay = it.get("payment") or {}
            print(
                f"   - {it.get('id')} created={it.get('date_created')} debit={it.get('debit_date')} "
                f"status={it.get('status')} retry={it.get('retry_attempt')} "
                f"payment.status={pay.get('status')} detail={pay.get('status_detail')} amount={it.get('transaction_amount')}"
            )
        except Exception as exc:  # noqa: BLE001
            print("   - error leyendo item:", exc)
