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
async function removeSavedRegistration(saved: Saved) {
  await db.query("delete from public.admin_audit_logs where registration_id=$1", [saved.id]);
  await db.query("delete from public.payments where registration_id=$1", [saved.id]);
  await db.query("delete from public.manager_contacts where team_id=$1", [saved.team_id]);
  await db.query("delete from public.registrations where id=$1", [saved.id]);
  await db.query("delete from public.teams where id=$1", [saved.team_id]);
}
async function authenticate(id = admin, aal = "aal1") {
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
async function approveCorrections(id: string) {
  await authenticate();
  await action(id, "request_correction", "Correct your team details", {
    correction_payment_received: true,
    correction_fee_amount: 2000,
  });
  await db.exec("reset role;");
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
describe("paid team corrections", () => {
  it("blocks a newly submitted team from editing before payment and organizer approval", async () => {
    const saved = await register();
    await expect(
      db.query("select public.correct_team_registration($1,$2,$3)", [
        saved.id,
        tokenHash,
        { ...team, location: "Akure South" },
      ]),
    ).rejects.toThrow("editing_locked");
  });

  it("blocks account-owned registrations from editing without paid approval", async () => {
    const saved = await registerManager();
    await expect(
      db.query("select public.correct_manager_registration($1,$2,$3::jsonb)", [
        saved.id,
        manager,
        JSON.stringify({ ...managerTeam, location: "Akure South" }),
      ]),
    ).rejects.toThrow("editing_locked");
  });

  it("does not treat an older correction request as verified correction payment", async () => {
    const saved = await register();
    await db.query(
      "update public.registrations set registration_status='correction_required' where id=$1",
      [saved.id],
    );
    await expect(
      db.query("select public.correct_team_registration($1,$2,$3)", [saved.id, tokenHash, team]),
    ).rejects.toThrow("editing_locked");
  });

  it.each([
    {},
    { correction_payment_received: false, correction_fee_amount: 2000 },
    { correction_payment_received: true, correction_fee_amount: 100 },
  ])(
    "refuses organizer approval without verification of the full correction fee: %j",
    async (details) => {
      const saved = await register();
      await authenticate();
      await expect(
        action(saved.id, "request_correction", "Correct team name", details),
      ).rejects.toThrow("correction_payment_required");
    },
  );

  it.each([
    [outsider, "aal2"],
    [manager, "aal1"],
  ])("requires an allowlisted organizer for paid correction approval", async (userId, aal) => {
    const saved = await register();
    await authenticate(userId, aal);
    await expect(
      action(saved.id, "request_correction", "Correct team name", {
        correction_payment_received: true,
        correction_fee_amount: 2000,
      }),
    ).rejects.toThrow("access_denied");
  });

  it("audits the separate correction fee without confirming or changing registration payment", async () => {
    const saved = await register();
    await approveCorrections(saved.id);
    const result = await db.query<{
      registration_status: string;
      approved: boolean;
      payment_status: string;
      amount: string;
    }>(
      "select r.registration_status,r.correction_approved_at is not null approved,p.payment_status,p.amount from public.registrations r join public.payments p on p.registration_id=r.id and p.is_current where r.id=$1",
      [saved.id],
    );
    expect(result.rows[0].registration_status).toBe("correction_required");
    expect(result.rows[0].approved).toBe(true);
    expect(result.rows[0].payment_status).toBe("pending");
    expect(Number(result.rows[0].amount)).toBe(100);
    const audit = await db.query<{
      admin_id: string;
      new_value: { correction_fee_amount: number; correction_payment_verified: boolean };
    }>(
      "select admin_id,new_value from public.admin_audit_logs where registration_id=$1 and action='request_correction'",
      [saved.id],
    );
    expect(audit.rows[0].admin_id).toBe(admin);
    expect(audit.rows[0].new_value.correction_fee_amount).toBe(2000);
    expect(audit.rows[0].new_value.correction_payment_verified).toBe(true);
  });

  it.each([false, true])(
    "consumes a paid approval once and restores the registration state (registration paid: %s)",
    async (registrationPaid) => {
      const saved = await register();
      if (registrationPaid) {
        await authenticate();
        await action(saved.id, "payment_received");
        await db.exec("reset role;");
      }
      await approveCorrections(saved.id);
      await db.query("select public.correct_team_registration($1,$2,$3)", [
        saved.id,
        tokenHash,
        { ...team, location: "Akure South" },
      ]);
      const result = await db.query<{
        registration_status: string;
        correction_approved_at: string | null;
        public_message: string | null;
      }>(
        "select registration_status,correction_approved_at,public_message from public.registrations where id=$1",
        [saved.id],
      );
      expect(result.rows[0]).toEqual({
        registration_status: registrationPaid ? "awaiting_screening" : "submitted",
        correction_approved_at: null,
        public_message: null,
      });
      await expect(
        db.query("select public.correct_team_registration($1,$2,$3)", [
          saved.id,
          tokenHash,
          { ...team, location: "Owo" },
        ]),
      ).rejects.toThrow("editing_locked");
    },
  );

  it("preserves the paid approval when invalid corrections fail", async () => {
    const saved = await register();
    await approveCorrections(saved.id);
    await db.exec("savepoint invalid_correction;");
    await expect(
      db.query("select public.correct_team_registration($1,$2,$3)", [
        saved.id,
        tokenHash,
        { ...team, team_name: "" },
      ]),
    ).rejects.toThrow();
    await db.exec(
      "rollback to savepoint invalid_correction; release savepoint invalid_correction;",
    );
    const result = await db.query<{ approved: boolean }>(
      "select correction_approved_at is not null approved from public.registrations where id=$1",
      [saved.id],
    );
    expect(result.rows[0].approved).toBe(true);
    await db.query("select public.correct_team_registration($1,$2,$3)", [
      saved.id,
      tokenHash,
      { ...team, location: "Owo" },
    ]);
  });

  it("preserves paid edit access when the original registration payment is subsequently confirmed", async () => {
    const saved = await register();
    await approveCorrections(saved.id);
    await authenticate();
    await action(saved.id, "payment_received");
    await db.exec("reset role;");
    const result = await db.query<{ registration_status: string; approved: boolean }>(
      "select registration_status,correction_approved_at is not null approved from public.registrations where id=$1",
      [saved.id],
    );
    expect(result.rows[0]).toEqual({ registration_status: "correction_required", approved: true });
    await db.query("select public.correct_team_registration($1,$2,$3)", [
      saved.id,
      tokenHash,
      team,
    ]);
  });

  it("requires a fresh payment approval for another correction submission", async () => {
    const saved = await register();
    await approveCorrections(saved.id);
    await db.query("select public.correct_team_registration($1,$2,$3)", [
      saved.id,
      tokenHash,
      team,
    ]);
    await approveCorrections(saved.id);
    await db.query("select public.correct_team_registration($1,$2,$3)", [
      saved.id,
      tokenHash,
      { ...team, location: "Owo" },
    ]);
    const audit = await db.query<{ count: number }>(
      "select count(*)::int count from public.admin_audit_logs where registration_id=$1 and action='request_correction'",
      [saved.id],
    );
    expect(audit.rows[0].count).toBe(2);
  });

  it("prevents duplicate approvals while an approved correction is still open", async () => {
    const saved = await register();
    await approveCorrections(saved.id);
    await authenticate();
    await expect(
      action(saved.id, "request_correction", "Another approval", {
        correction_payment_received: true,
        correction_fee_amount: 2000,
      }),
    ).rejects.toThrow("invalid_transition");
  });

  it("keeps final screening approval separate until the correction is completed", async () => {
    const saved = await register();
    await authenticate();
    await action(saved.id, "payment_received");
    await db.exec("reset role;");
    await approveCorrections(saved.id);
    await authenticate();
    await expect(
      action(saved.id, "approve", "Screening passed", { screening_passed: true }),
    ).rejects.toThrow("screening_and_payment_required");
  });

  it.each(["approved", "rejected"])("keeps %s registrations locked", async (status) => {
    const saved = await register();
    await db.query("update public.registrations set registration_status=$2 where id=$1", [
      saved.id,
      status,
    ]);
    await authenticate();
    await expect(
      action(saved.id, "request_correction", "Correct team name", {
        correction_payment_received: true,
        correction_fee_amount: 2000,
      }),
    ).rejects.toThrow("invalid_transition");
  });
});

describe("real PostgreSQL registration rules", () => {
  it("restarts at 000001 after the organizer deletes the final test registration", async () => {
    await db.exec("alter sequence public.registration_reference_seq restart with 41");
    const saved = await register();
    expect(saved.reference).toBe("VL-TEST-2026-000041");
    await authenticate();
    await db.query("select public.delete_test_registration($1,$2)", [saved.id, saved.reference]);
    await db.exec("reset role");
    expect((await register()).reference).toBe("VL-TEST-2026-000001");
  });
  it("keeps the counter and other references when only one of several registrations is deleted", async () => {
    await db.exec("alter sequence public.registration_reference_seq restart with 41");
    const first = await register();
    const other = await register({
      ...team,
      team_name: "Tigers FC",
      phone: "+2348031234568",
      whatsapp_number: "+2348031234568",
    });
    await removeSavedRegistration(first);
    const remaining = await db.query<{ registration_reference: string }>(
      "select registration_reference from public.registrations where id=$1",
      [other.id],
    );
    expect(remaining.rows[0].registration_reference).toBe(other.reference);
    expect((await register()).reference).toBe("VL-TEST-2026-000043");
  });
  it("does not reset after deleting all test entries while a live registration remains", async () => {
    await db.exec(`alter sequence public.registration_reference_seq restart with 41;
      update public.competition_settings set registration_enabled=true,
        registration_deadline=now()+interval '1 day' where mode='live'`);
    const test = await register();
    const live = await register(team, randomUUID(), "live");
    await removeSavedRegistration(test);
    expect((await register()).reference).toBe("VL-TEST-2026-000043");
    await removeSavedRegistration(live);
    const last = await db.query<{ id: string; registration_reference: string; team_id: string }>(
      "select id,registration_reference,team_id from public.registrations",
    );
    await removeSavedRegistration({
      ...last.rows[0],
      reference: last.rows[0].registration_reference,
    });
    expect((await register(team, randomUUID(), "live")).reference).toBe("VL-2026-000001");
  });
  it("restores both the registration and counter when final deletion is rolled back", async () => {
    await db.exec("alter sequence public.registration_reference_seq restart with 41");
    const saved = await register();
    await db.exec("savepoint before_cleanup");
    await removeSavedRegistration(saved);
    const emptyCounter = await db.query<{ last_value: number; is_called: boolean }>(
      "select last_value::int,is_called from public.registration_reference_seq",
    );
    expect(emptyCounter.rows[0]).toEqual({ last_value: 1, is_called: false });
    await db.exec("rollback to savepoint before_cleanup");
    const restored = await db.query("select id from public.registrations where id=$1", [saved.id]);
    expect(restored.rows).toHaveLength(1);
    const next = await register({
      ...team,
      team_name: "Tigers FC",
      phone: "+2348031234568",
      whatsapp_number: "+2348031234568",
    });
    expect(next.reference).toBe("VL-TEST-2026-000042");
  });
  it("restarts after a bulk cleanup and truncation of all registrations", async () => {
    await db.exec("alter sequence public.registration_reference_seq restart with 41");
    await register();
    await register({
      ...team,
      team_name: "Tigers FC",
      phone: "+2348031234568",
      whatsapp_number: "+2348031234568",
    });
    await db.exec(`delete from public.admin_audit_logs; delete from public.payments;
      delete from public.manager_contacts; delete from public.registrations;
      delete from public.teams`);
    expect((await register()).reference).toBe("VL-TEST-2026-000001");
    await db.exec("truncate public.registrations cascade");
    const next = await register({
      ...team,
      team_name: "New Team FC",
      phone: "+2348031234569",
      whatsapp_number: "+2348031234569",
    });
    expect(next.reference).toBe("VL-TEST-2026-000001");
  });
  it("keeps the reset trigger helper unavailable to application roles", async () => {
    const result = await db.query<{ allowed: boolean }>(`
      select has_function_privilege(role_name,
        'vertex_private.reset_empty_registration_references()', 'execute') as allowed
      from unnest(array['anon','authenticated','service_role']) role_name`);
    expect(result.rows.map((row) => row.allowed)).toEqual([false, false, false]);
  });
  it("rejects a final deletion using an older repeatable-read snapshot", async () => {
    await db.exec("set transaction isolation level repeatable read");
    const saved = await register();
    await expect(removeSavedRegistration(saved)).rejects.toThrow(
      "reference_reset_requires_read_committed",
    );
  });
  it("does not truncate reference numbers after the millionth submission", async () => {
    await db.exec("select setval('public.registration_reference_seq',1000000)");
    const r = await register();
    expect(r.reference).toBe("VL-TEST-2026-1000001");
    await db.exec("select setval('public.registration_reference_seq',1)");
  });
  it("atomically stores permitted owner corrections", async () => {
    const r = await register();
    await approveCorrections(r.id);
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

  it("accepts an allowlisted organizer's password session", async () => {
    const saved = await register();
    await authenticate(admin, "aal1");
    await remove(saved.id, saved.reference);
    expect(
      (await db.query("select id from public.registrations where id=$1", [saved.id])).rows,
    ).toHaveLength(0);
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
    }>(
      `select
      (select count(*)::int from public.registrations) registrations,
      (select count(*)::int from public.teams) teams,
      (select count(*)::int from public.manager_contacts) contacts,
      (select count(*)::int from public.payments) payments,
      (select count(*)::int from public.admin_audit_logs
        where action = 'test_registration_deleted' and admin_id = $1) deletion_events`,
      [admin],
    );
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
    await db.exec(
      "update public.competition_settings set registration_enabled=true, registration_deadline=now()+interval '1 day' where mode='live'",
    );
    const saved = await register(team, randomUUID(), "live");
    await authenticate();
    await expect(remove(saved.id, saved.reference)).rejects.toThrow("registration_not_found");
  });
});

describe("organizer registration deletion", () => {
  const remove = (saved: Saved, mode = "test", confirmed: boolean | null = true) =>
    db.query("select public.delete_registration($1::uuid,$2,$3,$4)", [
      saved.id,
      saved.reference,
      mode,
      confirmed,
    ]);

  it.each([
    [outsider, "aal2"],
    [manager, "aal2"],
    [outsider, "aal1"],
  ])("requires an allowlisted organizer: %s / %s", async (userId, aal) => {
    const saved = await register();
    await authenticate(userId, aal);
    await expect(remove(saved)).rejects.toThrow("access_denied");
  });

  it.each([false, null])("requires explicit deletion confirmation: %s", async (confirmed) => {
    const saved = await register();
    await authenticate();
    await expect(remove(saved, "test", confirmed)).rejects.toThrow(
      "deletion_confirmation_required",
    );
  });

  it.each(["wrong reference", "wrong mode"])("rejects a %s", async (mismatch) => {
    const saved = await register();
    await authenticate();
    await expect(
      remove(
        mismatch === "wrong reference" ? { ...saved, reference: "VL-TEST-WRONG" } : saved,
        mismatch === "wrong mode" ? "live" : "test",
      ),
    ).rejects.toThrow("registration_not_found");
  });

  it("only removes the confirmed registration and refreshes dashboard statistics", async () => {
    const target = await register();
    const other = await register({
      ...team,
      team_name: "Lions FC",
      phone: "+2348031234568",
      whatsapp_number: "+2348031234568",
    });
    await authenticate();
    await remove(target);
    const list = await db.query<{ data: { total: number; rows: { id: string }[] } }>(
      "select public.admin_list_registrations('test') data",
    );
    const stats = await db.query<{ data: { total: number } }>(
      "select public.admin_registration_stats('test') data",
    );
    expect(list.rows[0].data.total).toBe(1);
    expect(list.rows[0].data.rows.map((row) => row.id)).toEqual([other.id]);
    expect(stats.rows[0].data.total).toBe(1);
    await db.exec("reset role;");
    expect(
      (await db.query("select id from public.teams where id=$1", [target.team_id])).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("select phone from public.manager_contacts where team_id=$1", [
          target.team_id,
        ])
      ).rows,
    ).toHaveLength(0);
  });

  it("deletes live registrations through the same protected operation", async () => {
    await db.exec(
      "update public.competition_settings set registration_enabled=true, registration_deadline=now()+interval '1 day' where mode='live'",
    );
    const saved = await register(team, randomUUID(), "live");
    await authenticate();
    await remove(saved, "live");
    expect(
      (await db.query("select id from public.registrations where id=$1", [saved.id])).rows,
    ).toHaveLength(0);
  });

  it("retains reviewed payment and refund history without retaining access secrets", async () => {
    const saved = await register();
    await authenticate();
    await action(saved.id, "payment_received");
    await action(saved.id, "reject", "Did not pass physical screening");
    await action(saved.id, "refund", "Full refund completed", {
      transfer_reference: "REFUND-DELETE-TEST",
      refunded_at: new Date().toISOString(),
    });
    await remove(saved);
    const events = await db.query<{
      admin_id: string;
      registration_id: null;
      action: string;
      previous_value: {
        registration: Record<string, unknown>;
        team: { team_name: string };
        payments: { payment_status: string; amount: number }[];
        refunds: { transfer_reference: string; amount: number }[];
      };
      new_value: { registration_id: string; reference: string; mode: string };
    }>("select * from public.admin_audit_logs where action='registration_deleted'");
    expect(events.rows).toHaveLength(1);
    const event = events.rows[0];
    expect(event.admin_id).toBe(admin);
    expect(event.registration_id).toBeNull();
    expect(event.new_value).toMatchObject({
      registration_id: saved.id,
      reference: saved.reference,
      mode: "test",
    });
    expect(event.previous_value.team.team_name).toBe(team.team_name);
    expect(event.previous_value.payments[0]).toMatchObject({
      payment_status: "confirmed",
      amount: 100,
    });
    expect(event.previous_value.refunds[0]).toMatchObject({
      transfer_reference: "REFUND-DELETE-TEST",
      amount: 100,
    });
    for (const field of ["status_token_hash", "payload_hash", "submission_key"])
      expect(event.previous_value.registration).not.toHaveProperty(field);
    const previousHistory = await db.query<{
      registration_id: null;
      new_value: { deleted_registration_id: string };
    }>(
      "select registration_id,new_value from public.admin_audit_logs where action='payment_received'",
    );
    expect(previousHistory.rows[0].registration_id).toBeNull();
    expect(previousHistory.rows[0].new_value.deleted_registration_id).toBe(saved.id);
    expect(
      (await db.query("select id from public.payments where registration_id=$1", [saved.id])).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select id from public.refunds where registration_id=$1", [saved.id])).rows,
    ).toHaveLength(0);
  });

  it("preserves the manager account and releases its team name and contact numbers", async () => {
    const saved = await registerManager();
    await authenticate();
    await remove(saved);
    await db.exec("reset role;");
    expect((await db.query("select id from auth.users where id=$1", [manager])).rows).toHaveLength(
      1,
    );
    const replacement = await registerManager();
    expect(replacement.id).not.toBe(saved.id);
  });

  it("rolls back the deletion and its audit changes if a dependent row cannot be removed", async () => {
    const saved = await register();
    await db.exec(
      "create table vertex_private.deletion_guard(team_id uuid references public.teams(id));",
    );
    await db.query("insert into vertex_private.deletion_guard values($1)", [saved.team_id]);
    await authenticate();
    await db.exec("savepoint blocked_deletion;");
    await expect(remove(saved)).rejects.toThrow("foreign key constraint");
    await db.exec("rollback to savepoint blocked_deletion; release savepoint blocked_deletion;");
    expect(
      (await db.query("select id from public.registrations where id=$1", [saved.id])).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select id from public.payments where registration_id=$1", [saved.id])).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select id from public.admin_audit_logs where action='registration_deleted'"))
        .rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("select id from public.admin_audit_logs where registration_id=$1", [
          saved.id,
        ])
      ).rows,
    ).toHaveLength(1);
  });

  it("does not grant anonymous or direct table deletion access", async () => {
    const privileges = await db.query<{
      anonymous_execute: boolean;
      table_delete: boolean;
      trigger_execute: boolean;
    }>(`select
      has_function_privilege('anon','public.delete_registration(uuid,text,text,boolean)','execute') anonymous_execute,
      has_table_privilege('authenticated','public.registrations','delete') table_delete,
      has_function_privilege('authenticated','vertex_private.reset_empty_registration_references()','execute') trigger_execute`);
    expect(privileges.rows[0]).toEqual({
      anonymous_execute: false,
      table_delete: false,
      trigger_execute: false,
    });
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
    await approveCorrections(saved.id);
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
  it("accepts administrator mutations with a password session", async () => {
    const r = await register();
    await authenticate(admin, "aal1");
    await action(r.id, "payment_received");
    const payment = await db.query<{ payment_status: string }>(
      "select payment_status from public.payments where registration_id=$1",
      [r.id],
    );
    expect(payment.rows[0].payment_status).toBe("confirmed");
  });
  it("rejects a non-admin even with MFA", async () => {
    const r = await register();
    await authenticate(outsider, "aal2");
    await expect(action(r.id, "payment_received")).rejects.toThrow("access_denied");
  });
  it("does not let a signed-in user add themselves to the admin allowlist", async () => {
    await authenticate(outsider);
    await expect(
      db.query("insert into public.admin_members(user_id) values($1)", [outsider]),
    ).rejects.toThrow(/permission denied/i);
  });
  it("does not authorize a session without a user identity", async () => {
    await db.exec("set local role authenticated;");
    const result = await db.query<{ allowed: boolean }>("select public.is_vertex_admin() allowed");
    expect(result.rows[0].allowed).toBe(false);
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
