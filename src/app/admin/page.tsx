import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Download, LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { deploymentMode } from "@/lib/config/server";
import { filterSchema, type AdminListRow } from "@/lib/admin";
import { dateLabel, money, humanize } from "@/lib/utils";
import { signOutAdmin } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { Notice } from "@/components/shared";
import { DeleteTestRegistration } from "@/components/admin/delete-test-registration";
export const metadata: Metadata = {
  title: "Registration dashboard",
  robots: { index: false, follow: false },
};
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { client } = await requireAdmin();
  const f = filterSchema.parse(await searchParams);
  const mode = deploymentMode();
  const [statsResult, listResult] = await Promise.all([
    client.rpc("admin_registration_stats", { p_mode: mode }),
    client.rpc("admin_list_registrations", {
      p_mode: mode,
      p_search: f.q,
      p_payment: f.payment,
      p_status: f.status,
      p_page: f.page,
      p_from: f.from || null,
      p_to: f.to || null,
    }),
  ]);
  const stats = statsResult.data as Record<string, number> | null;
  const list = listResult.data as { rows: AdminListRow[]; total: number } | null;
  const query = (page: number) =>
    `/admin?${new URLSearchParams({ q: f.q, payment: f.payment, status: f.status, from: f.from, to: f.to, page: String(page) })}`;
  return (
    <div className="container page-space">
      <div className="dashboard-head">
        <div>
          <p className="eyebrow">ORGANIZER DESK / {mode.toUpperCase()}</p>
          <h1>Team registrations.</h1>
        </div>
        <div className="dashboard-actions">
          <Button asChild variant="outline" size="sm">
            <a
              href={`/admin/export?${new URLSearchParams({ q: f.q, payment: f.payment, status: f.status, from: f.from, to: f.to })}`}
            >
              <Download size={15} /> Export filtered CSV
            </a>
          </Button>
          <form action={signOutAdmin}>
            <Button variant="outline" size="sm">
              <LogOut size={14} /> Sign out
            </Button>
          </form>
        </div>
      </div>
      {mode === "test" && (
        <Notice>
          Test registrations are shown here. They do not count as live competition entrants.
        </Notice>
      )}
      {(statsResult.error || listResult.error) && (
        <Notice tone="error">
          The dashboard could not load. Check the database migrations and your administrator
          permissions, then refresh.
        </Notice>
      )}
      {stats && (
        <dl className="summary-cards">
          {[
            ["total", "Registrations"],
            ["pending", "Payment pending"],
            ["confirmed", "Payments received"],
            ["approved", "Approved teams"],
            ["refunds_due", "Refunds due"],
          ].map(([key, label]) => (
            <div className="summary-card" key={key}>
              <dt>{label}</dt>
              <dd>{stats[key] ?? 0}</dd>
            </div>
          ))}
        </dl>
      )}
      <form className="filters" action="/admin">
        <label className="field">
          <span className="hint">Search</span>
          <Input
            name="q"
            defaultValue={f.q}
            maxLength={80}
            placeholder="Team, manager or reference"
          />
        </label>
        <label className="field">
          <span className="hint">Payment</span>
          <select name="payment" defaultValue={f.payment} className="input">
            <option value="">All payments</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label className="field">
          <span className="hint">Registration</span>
          <select name="status" defaultValue={f.status} className="input">
            <option value="">All registrations</option>
            {["submitted", "awaiting_screening", "correction_required", "approved", "rejected"].map(
              (s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="field">
          <span className="hint">From</span>
          <Input name="from" type="date" defaultValue={f.from} />
        </label>
        <label className="field">
          <span className="hint">To</span>
          <Input name="to" type="date" defaultValue={f.to} />
        </label>
        <Button type="submit" size="sm">
          Apply
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin">Reset</Link>
        </Button>
      </form>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">Vertex League registrations in {mode} mode</caption>
          <thead>
            <tr>
              {[
                "Reference",
                "Team & manager",
                "Phone",
                "Submitted",
                "Fee",
                "Payment",
                "Registration",
                "",
              ].map((head, i) => (
                <th key={i} scope="col">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list?.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.registration_reference}</td>
                <td>
                  <strong>{row.team_name}</strong>
                  <br />
                  <span className="muted">{row.manager_name}</span>
                </td>
                <td>{row.phone}</td>
                <td>{dateLabel(row.submitted_at)}</td>
                <td>{money(row.registration_fee)}</td>
                <td>
                  <StatusBadge status={row.payment_status} />
                </td>
                <td>
                  <StatusBadge status={row.registration_status} />
                  {row.refund_status !== "none" && (
                    <>
                      <br />
                      <span className="small">Refund: {row.refund_status}</span>
                    </>
                  )}
                </td>
                <td>
                  <div className="record-actions">
                    <Link href={`/admin/registrations/${row.id}`}>
                      Review <ArrowUpRight size={13} style={{ display: "inline" }} />
                    </Link>
                    <DeleteTestRegistration
                      id={row.id}
                      reference={row.registration_reference}
                      mode={mode}
                      payment={row.payment_status}
                      status={row.registration_status}
                      refund={row.refund_status}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {list?.rows.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <h2>
                      {f.q || f.payment || f.status
                        ? "No matching registrations."
                        : "Your first team is still to come."}
                    </h2>
                    <p>
                      {f.q || f.payment || f.status
                        ? "Try changing the search or filters."
                        : "Submitted teams will appear here when registration opens."}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {list && (
        <div className="pagination">
          <span>
            {list.total} registration{list.total === 1 ? "" : "s"} · Page {f.page} of{" "}
            {Math.max(1, Math.ceil(list.total / 20))}
          </span>
          <div className="button-row">
            {f.page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={query(f.page - 1)}>Previous</Link>
              </Button>
            )}
            {f.page * 20 < list.total && (
              <Button asChild variant="outline" size="sm">
                <Link href={query(f.page + 1)}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
