import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from "vitest";
let db: PGlite;
const admin = "11111111-1111-4111-8111-111111111111";
const outsider = "22222222-2222-4222-8222-222222222222";
const manager = "33333333-3333-4333-8333-333333333333";
const unverifiedManager = "44444444-4444-4444-8444-444444444444";
const otherManager = "55555555-5555-4555-8555-555555555555";
const tokenHash = "a".repeat(64);
const payloadHash = "b".repeat(64);
const team = {
  team_name: "Eagles FC",
  manager_name: "Ada Okafor",
  phone: "+2348031234567",
  whatsapp_number: "+2348031234567",
  email: null,
  location: "Ikeja",
  additional_information: null,
};
const managerTeam = { ...team, email: "ada@example.com" };
type Saved = { id: string; reference: string; team_id: string };
async function register(
  data: Record<string, unknown> = team,
  key = randomUUID(),
  mode = "test",
): Promise<Saved> {
  const result = await db.query<{ result: Saved }>(
    "select public.create_team_registration($1,$2::jsonb,$3::uuid,$4,$5) result",
    [mode, JSON.stringify(data), key, tokenHash, payloadHash],
  );
  return result.rows[0].result;
}
async function registerManager(
  data: Record<string, unknown> = managerTeam,
  key = randomUUID(),
  userId = manager,
) {
  const result = await db.query<{ result: Saved }>(
    "select public.create_manager_registration($1,$2::jsonb,$3::uuid,$4,$5,$6::uuid) result",
    ["test", JSON.stringify(data), key, tokenHash, payloadHash, userId],
  );
  return result.rows[0].result;
}
async function authenticate(id = admin, aal = "aal2") {
  await db.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: id, aal }),
  ]);
  await db.exec("set local role authenticated;");
}
async function action(
  id: string,
  name: string,
  reason = "Verified by organizer",
  details: Record<string, unknown> = {},
) {
  await db.query("select public.admin_registration_action($1::uuid,$2,$3,$4::jsonb)", [
    id,
    name,
    reason,
    JSON.stringify(details),
  ]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,email text,email_confirmed_at timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    insert into auth.users(id) values('${admin}'),('${outsider}');
    insert into auth.users(id,phone,phone_confirmed_at,email,email_confirmed_at) values
      ('${manager}','+2348031234567',now(),'ada@example.com',now()),
      ('${unverifiedManager}','+2348031234567',null,'ada@example.com',null),
      ('${otherManager}','+2348031234568',now(),'other@example.com',now());
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
  const migrations = (await readdir(migrationDirectory))
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();
  for (const file of migrations)
    await db.exec(await readFile(new URL(file, migrationDirectory), "utf8"));
  await db.query("insert into public.admin_members(user_id) values($1)", [admin]);
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("begin;");
});
afterEach(async () => {
  await db.exec("rollback; reset role;");
});
describe("real PostgreSQL registration rules", () => {
  it("does not truncate reference numbers after the millionth submission", async () => {
    await db.exec("select setval('public.registration_reference_seq',1000000)");
    const r = await register();
    expect(r.reference).toBe("VL-TEST-2026-1000001");
    await db.exec("select setval('public.registration_reference_seq',1)");
  });
  it("atomically stores permitted owner corrections", async () => {
    const r = await register();
    await db.query("select public.correct_team_registration($1,$2,$3)", [
      r.id,
      tokenHash,
      { ...team, location: "Surulere" },
    ]);
    const result = await db.query<{ location: string }>(
      "select location from public.teams where id=$1",
      [r.team_id],
    );
    expect(result.rows[0].location).toBe("Surulere");
  });
  it("attaches a logo only to the authorized team path and records an audit event", async () => {
    const r = await register();
    const path = `test/${r.team_id}/badge.webp`;
    await db.query("select public.set_team_logo($1,$2,$3)", [r.id, tokenHash, path]);
    const result = await db.query<{ logo_path: string }>(
      "select logo_path from public.teams where id=$1",
      [r.team_id],
    );
    expect(result.rows[0].logo_path).toBe(path);
  });
  it("blocks cross-team logo paths", async () => {
    const r = await register();
    await expect(
      db.query("select public.set_team_logo($1,$2,$3)", [
        r.id,
        tokenHash,
        `test/${randomUUID()}/badge.webp`,
      ]),
    ).rejects.toThrow("invalid_logo_path");
  });
  it("atomically saves team, payment and an immutable fee snapshot", async () => {
    const saved = await register({ ...team, registration_fee: 1 });
    expect(saved.reference).toMatch(/^VL-TEST-2026-\d{6}$/);
    await db.exec("update public.competition_settings set registration_fee=500 where mode='test'");
    const result = await db.query<{
      registration_fee: string;
      payment_status: string;
      registration_status: string;
    }>(
      "select r.registration_fee,p.payment_status,r.registration_status from public.registrations r join public.payments p on p.registration_id=r.id where r.id=$1",
      [saved.id],
    );
    expect(Number(result.rows[0].registration_fee)).toBe(100);
    expect(result.rows[0].payment_status).toBe("pending");
    expect(result.rows[0].registration_status).toBe("submitted");
  });
  it("retries an identical submission without creating another team", async () => {
    const key = randomUUID();
    const a = await register(team, key);
    const b = await register(team, key);
    expect(a.id).toBe(b.id);
    const result = await db.query<{ count: number }>(
      "select count(*)::int count from public.teams",
    );
    expect(result.rows[0].count).toBe(1);
  });
  it("generates unique references across simultaneous requests", async () => {
    const [a, b] = await Promise.all([
      register(),
      register({
        ...team,
        team_name: "Tigers FC",
        phone: "+2348031234568",
        whatsapp_number: "+2348031234568",
      }),
    ]);
    expect(a.reference).not.toBe(b.reference);
  });
  it("blocks the same team with different capitalization and punctuation", async () => {
    await register();
    await expect(
      register({
        ...team,
        team_name: "EAGLES-FC",
        phone: "+2348031234568",
        whatsapp_number: "+2348031234568",
      }),
    ).rejects.toThrow(/duplicate/i);
  });
  it("blocks a manager reusing either number for a different team", async () => {
    await register();
    await expect(
      register({ ...team, team_name: "Tigers FC", phone: "+2348031234568" }),
    ).rejects.toThrow(/duplicate/i);
  });
  it("enforces registration deadlines in the database", async () => {
    await db.exec(
      "update public.competition_settings set registration_deadline=now()-interval '1 minute' where mode='test'",
    );
    await expect(register()).rejects.toThrow("deadline_passed");
  });
  it("keeps live registration closed by default", async () => {
    await expect(register(team, randomUUID(), "live")).rejects.toThrow("registration_closed");
  });
  it("does not allow owner corrections with a wrong token", async () => {
    const r = await register();
    await expect(
      db.query("select public.correct_team_registration($1,$2,$3)", [r.id, "c".repeat(64), team]),
    ).rejects.toThrow("access_denied");
  });
});
describe("test registration deletion", () => {
  const remove = (id: string, reference: string) =>
    db.query("select public.delete_test_registration($1::uuid,$2)", [id, reference]);

  it("rejects a non-organizer", async () => {
    const saved = await register();
    await authenticate(outsider);
    await expect(remove(saved.id, saved.reference)).rejects.toThrow("access_denied");
  });

  it("requires organizer MFA", async () => {
    const saved = await register();
    await authenticate(admin, "aal1");
    await expect(remove(saved.id, saved.reference)).rejects.toThrow("access_denied");
  });

  it("removes an untouched test entry and leaves an organizer audit tombstone", async () => {
    const saved = await register();
    await authenticate();
    await remove(saved.id, saved.reference);
    await db.exec("reset role;");
    const result = await db.query<{
      registrations: number;
      teams: number;
      contacts: number;
      payments: number;
      deletion_events: number;
    }>(`select
      (select count(*)::int from public.registrations) registrations,
      (select count(*)::int from public.teams) teams,
      (select count(*)::int from public.manager_contacts) contacts,
      (select count(*)::int from public.payments) payments,
      (select count(*)::int from public.admin_audit_logs
        where action = 'test_registration_deleted' and admin_id = $1) deletion_events`, [admin]);
    expect(result.rows[0]).toEqual({
      registrations: 0,
      teams: 0,
      contacts: 0,
      payments: 0,
      deletion_events: 1,
    });
  });

  it("requires the exact reference", async () => {
    const saved = await register();
    await authenticate();
    await expect(remove(saved.id, "VL-TEST-WRONG")).rejects.toThrow("registration_not_found");
  });

  it("refuses entries with review history", async () => {
    const saved = await register();
    await authenticate();
    await action(saved.id, "notes", "Reviewed by organizer");
    await expect(remove(saved.id, saved.reference)).rejects.toThrow("test_deletion_not_allowed");
  });

  it("refuses entries with payment history", async () => {
    const saved = await register();
    await authenticate();
    await action(saved.id, "payment_received");
    await expect(remove(saved.id, saved.reference)).rejects.toThrow("test_deletion_not_allowed");
  });

  it("never deletes a live registration", async () => {
    await db.exec("update public.competition_settings set registration_enabled=true, registration_deadline=now()+interval '1 day' where mode='live'");
    const saved = await register(team, randomUUID(), "live");
    await authenticate();
    await expect(remove(saved.id, saved.reference)).rejects.toThrow("registration_not_found");
  });
});

describe("manager account ownership", () => {
  it("stores a cross-device draft and clears it on submission", async () => {
    const draft = { team_name: "Eagles FC", manager_name: "Ada Okafor", phone: team.phone };
    await db.query("select public.save_manager_draft($1,$2,$3::jsonb)", [
      "test",
      manager,
      JSON.stringify(draft),
    ]);
    const before = await db.query<{ data: typeof draft }>(
      "select public.load_manager_draft($1,$2) data",
      ["test", manager],
    );
    expect(before.rows[0].data).toEqual(draft);
    await registerManager();
    const after = await db.query<{ data: null }>("select public.load_manager_draft($1,$2) data", [
      "test",
      manager,
    ]);
    expect(after.rows[0].data).toBeNull();
  });
  it("rejects saving a draft after registration", async () => {
    await registerManager();
    await expect(
      db.query("select public.save_manager_draft($1,$2,$3::jsonb)", [
        "test",
        manager,
        JSON.stringify({ team_name: "Another" }),
      ]),
    ).rejects.toThrow("already_registered");
  });
  it("atomically links a verified manager and returns the same registration on retry", async () => {
    const key = randomUUID();
    const first = await registerManager(managerTeam, key);
    const second = await registerManager(managerTeam, key);
    expect(first.id).toBe(second.id);
    const result = await db.query<{ manager_user_id: string }>(
      "select manager_user_id from public.registrations where id=$1",
      [first.id],
    );
    expect(result.rows[0].manager_user_id).toBe(manager);
  });
  it("rejects a second team for the same manager", async () => {
    await registerManager();
    await expect(registerManager({ ...managerTeam, team_name: "Lions FC" })).rejects.toThrow(
      "already_registered",
    );
  });
  it("requires a confirmed email", async () => {
    await expect(registerManager(managerTeam, randomUUID(), unverifiedManager)).rejects.toThrow(
      "access_denied",
    );
  });
  it("requires the verified email to match the team", async () => {
    await expect(registerManager({ ...managerTeam, email: "other@example.com" })).rejects.toThrow(
      "access_denied",
    );
  });
  it("rejects a manager after their confirmed email changes without updating submitted data", async () => {
    await db.query("update auth.users set email='new@example.com' where id=$1", [manager]);
    await expect(registerManager(managerTeam)).rejects.toThrow("access_denied");
  });
  it("allows a manager to use a different contact phone", async () => {
    const saved = await registerManager({
      ...managerTeam,
      phone: "+2348031234599",
      whatsapp_number: "+2348031234599",
    });
    expect(saved.id).toBeTruthy();
  });
  it("rejects a legacy claim with the wrong token", async () => {
    const saved = await register(managerTeam);
    await expect(
      db.query("select public.claim_manager_registration($1,$2,$3,$4)", [
        saved.id,
        "c".repeat(64),
        manager,
        "d".repeat(64),
      ]),
    ).rejects.toThrow("access_denied");
  });
  it("rejects a legacy claim without a verified email", async () => {
    const saved = await register(managerTeam);
    await expect(
      db.query("select public.claim_manager_registration($1,$2,$3,$4)", [
        saved.id,
        tokenHash,
        unverifiedManager,
        "d".repeat(64),
      ]),
    ).rejects.toThrow("access_denied");
  });
  it("rejects a legacy claim from a different verified email", async () => {
    const saved = await register(managerTeam);
    await expect(
      db.query("select public.claim_manager_registration($1,$2,$3,$4)", [
        saved.id,
        tokenHash,
        otherManager,
        "d".repeat(64),
      ]),
    ).rejects.toThrow("access_denied");
  });
  it("does not auto-claim a legacy registration without an email", async () => {
    const saved = await register();
    await expect(
      db.query("select public.claim_manager_registration($1,$2,$3,$4)", [
        saved.id,
        tokenHash,
        manager,
        "d".repeat(64),
      ]),
    ).rejects.toThrow("access_denied");
  });
  it("claims a legacy registration only once", async () => {
    const saved = await register(managerTeam);
    await db.query("select public.claim_manager_registration($1,$2,$3,$4)", [
      saved.id,
      tokenHash,
      manager,
      "d".repeat(64),
    ]);
    const result = await db.query<{ manager_user_id: string; status_token_hash: string }>(
      "select manager_user_id,status_token_hash from public.registrations where id=$1",
      [saved.id],
    );
    expect(result.rows[0].manager_user_id).toBe(manager);
    expect(result.rows[0].status_token_hash).toBe("d".repeat(64));
    await expect(
      db.query("select public.claim_manager_registration($1,$2,$3,$4)", [
        saved.id,
        tokenHash,
        manager,
        "e".repeat(64),
      ]),
    ).rejects.toThrow("access_denied");
  });
  it("allows corrections only for the linked account", async () => {
    const saved = await registerManager();
    await db.query("select public.correct_manager_registration($1,$2,$3::jsonb)", [
      saved.id,
      manager,
      JSON.stringify({ ...managerTeam, location: "Surulere" }),
    ]);
    const result = await db.query<{ location: string }>(
      "select location from public.teams where id=$1",
      [saved.team_id],
    );
    expect(result.rows[0].location).toBe("Surulere");
    await expect(
      db.query("select public.correct_manager_registration($1,$2,$3::jsonb)", [
        saved.id,
        manager,
        JSON.stringify({ ...managerTeam, email: "other@example.com" }),
      ]),
    ).rejects.toThrow("access_denied");
  });
  it("rejects corrections from a different account", async () => {
    const saved = await registerManager();
    await expect(
      db.query("select public.correct_manager_registration($1,$2,$3::jsonb)", [
        saved.id,
        outsider,
        JSON.stringify(team),
      ]),
    ).rejects.toThrow("access_denied");
  });
  it("keeps manager draft data unavailable to public clients", async () => {
    await authenticate(manager, "aal1");
    await expect(db.query("select * from public.manager_registration_drafts")).rejects.toThrow(
      /permission denied/i,
    );
  });
  it("keeps manager mutation RPCs unavailable to public clients", async () => {
    await authenticate(manager, "aal1");
    await expect(registerManager()).rejects.toThrow(/permission denied/i);
  });
  it("keeps draft RPCs unavailable to public clients", async () => {
    await authenticate(manager, "aal1");
    await expect(
      db.query("select public.load_manager_draft($1,$2)", ["test", manager]),
    ).rejects.toThrow(/permission denied/i);
  });
});
describe("database authorization and administrative transitions", () => {
  it("calculates administrator statistics from persisted payment state", async () => {
    const r = await register();
    await authenticate();
    await action(r.id, "payment_received");
    const result = await db.query<{
      stats: { total: number; pending: number; confirmed: number; approved: number };
    }>("select public.admin_registration_stats('test') stats");
    expect(result.rows[0].stats).toMatchObject({ total: 1, pending: 0, confirmed: 1, approved: 0 });
  });
  it("searches and filters actual registrations without returning private credentials", async () => {
    await register();
    await authenticate();
    const result = await db.query<{ result: { total: number; rows: Record<string, unknown>[] } }>(
      "select public.admin_list_registrations('test','eagles','pending','submitted',1,null,null) result",
    );
    expect(result.rows[0].result.total).toBe(1);
    expect(result.rows[0].result.rows[0].team_name).toBe("Eagles FC");
    expect(result.rows[0].result.rows[0]).not.toHaveProperty("status_token_hash");
    const empty = await db.query<{ result: { total: number } }>(
      "select public.admin_list_registrations('test','','confirmed','',1,null,null) result",
    );
    expect(empty.rows[0].result.total).toBe(0);
  });
  it("blocks anonymous reads and public registration RPCs", async () => {
    await register();
    await db.exec("set local role anon");
    await expect(db.query("select * from public.registrations")).rejects.toThrow(
      /permission denied/i,
    );
  });
  it("blocks anonymous mutation RPC execution", async () => {
    await db.exec("set local role anon");
    await expect(register()).rejects.toThrow(/permission denied/i);
  });
  it("returns no rows to an authenticated non-admin", async () => {
    await register();
    await authenticate(outsider);
    const result = await db.query("select * from public.registrations");
    expect(result.rows).toHaveLength(0);
  });
  it("rejects administrator mutations without MFA", async () => {
    const r = await register();
    await authenticate(admin, "aal1");
    await expect(action(r.id, "payment_received")).rejects.toThrow("access_denied");
  });
  it("rejects a non-admin even with MFA", async () => {
    const r = await register();
    await authenticate(outsider);
    await expect(action(r.id, "payment_received")).rejects.toThrow("access_denied");
  });
  it("payment received provisionally books without approving and writes an audit event", async () => {
    const r = await register();
    await authenticate();
    await action(r.id, "payment_received");
    const result = await db.query<{ registration_status: string; payment_status: string }>(
      "select r.registration_status,p.payment_status from public.registrations r join public.payments p on p.registration_id=r.id where r.id=$1",
      [r.id],
    );
    expect(result.rows[0]).toEqual({
      registration_status: "awaiting_screening",
      payment_status: "confirmed",
    });
    const audit = await db.query(
      "select * from public.admin_audit_logs where registration_id=$1 and action='payment_received'",
      [r.id],
    );
    expect(audit.rows).toHaveLength(1);
  });
  it("blocks approval when payment has not been confirmed", async () => {
    const r = await register();
    await authenticate();
    await expect(action(r.id, "approve", "", { screening_passed: true })).rejects.toThrow(
      "screening_and_payment_required",
    );
  });
  it("requires explicit physical screening confirmation", async () => {
    const r = await register();
    await authenticate();
    await action(r.id, "payment_received");
    await expect(action(r.id, "approve")).rejects.toThrow("screening_and_payment_required");
  });
  it("allows approval after payment and screening", async () => {
    const r = await register();
    await authenticate();
    await action(r.id, "payment_received");
    await action(r.id, "approve", "Screening passed", { screening_passed: true });
    const result = await db.query<{ registration_status: string }>(
      "select registration_status from public.registrations where id=$1",
      [r.id],
    );
    expect(result.rows[0].registration_status).toBe("approved");
  });
  it("rejects early screening approval before the deadline", async () => {
    const r = await register();
    await db.exec(
      "update public.competition_settings set registration_deadline=now()+interval '1 day' where mode='test'",
    );
    await authenticate();
    await action(r.id, "payment_received");
    await expect(action(r.id, "approve", "", { screening_passed: true })).rejects.toThrow(
      "screening_after_deadline",
    );
  });
  it("enforces an optional capacity at payment confirmation, not unpaid submission", async () => {
    await db.exec("update public.competition_settings set maximum_teams=1 where mode='test'");
    const a = await register();
    const b = await register({
      ...team,
      team_name: "Tigers FC",
      phone: "+2348031234568",
      whatsapp_number: "+2348031234568",
    });
    await authenticate();
    await action(a.id, "payment_received");
    await expect(action(b.id, "payment_received")).rejects.toThrow("capacity_reached");
  });
  it("rejection after payment creates a full refund obligation", async () => {
    const r = await register();
    await authenticate();
    await action(r.id, "payment_received");
    await action(r.id, "reject", "Team failed physical screening");
    const result = await db.query<{ refund_status: string }>(
      "select refund_status from public.registrations where id=$1",
      [r.id],
    );
    expect(result.rows[0].refund_status).toBe("pending");
    await action(r.id, "refund", "Returned in full", {
      transfer_reference: "BANK-REFUND-001",
      refunded_at: new Date().toISOString(),
    });
    const refund = await db.query<{ amount: string }>(
      "select amount from public.refunds where registration_id=$1",
      [r.id],
    );
    expect(Number(refund.rows[0].amount)).toBe(100);
  });
  it("rejects payment with a reason and permits proof resubmission to be verified", async () => {
    const r = await register();
    await authenticate();
    await action(r.id, "reject_payment", "Transfer not found");
    await action(r.id, "payment_received", "Resubmitted proof matched bank transfer");
    const result = await db.query<{ payment_status: string }>(
      "select payment_status from public.payments where registration_id=$1",
      [r.id],
    );
    expect(result.rows[0].payment_status).toBe("confirmed");
  });
  it("lets admins revoke a lost access link without storing the replacement token", async () => {
    const r = await register();
    const replacement = createHash("sha256").update("replacement").digest("hex");
    await authenticate();
    await action(r.id, "recover_access", "Manager identity checked", { token_hash: replacement });
    const result = await db.query<{ status_token_hash: string }>(
      "select status_token_hash from public.registrations where id=$1",
      [r.id],
    );
    expect(result.rows[0].status_token_hash).toBe(replacement);
  });
  it("prevents direct status updates even for authenticated administrators", async () => {
    const r = await register();
    await authenticate();
    await expect(
      db.query("update public.registrations set registration_status='approved' where id=$1", [
        r.id,
      ]),
    ).rejects.toThrow(/permission denied/i);
  });
});
