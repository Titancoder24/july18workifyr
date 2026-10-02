"use client";

import { useMemo, useState } from "react";
import { ContactRound, Download, Layers3, Search, ShieldBan, Upload } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { OutreachWorkflowNav } from "@/components/outreach/workflow-nav";
import {
  contactName,
  csvExample,
  isValidEmail,
  parseContactCsv,
  type OutreachContact,
} from "@/lib/outreach/model";
import { useOutreach } from "@/lib/outreach/use-outreach";

export default function OutreachContactsPage() {
  const { state, ready, error, addContact, importContacts, createList: persistList, markDoNotContact } = useOutreach();
  const [query, setQuery] = useState("");
  const [listName, setListName] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [notice, setNotice] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Omit<OutreachContact, "id" | "status">[]>([]);
  const [rejected, setRejected] = useState(0);
  const [importListId, setImportListId] = useState("");
  const [importListName, setImportListName] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.contacts.filter((contact) => {
      if (!needle) return true;
      return [contact.firstName, contact.lastName, contact.company, contact.role, contact.email, contact.region, ...contact.tags]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [query, state.contacts]);

  function downloadExample() {
    const url = URL.createObjectURL(new Blob([csvExample()], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "workifyr-contacts-example.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function previewFile(file: File) {
    const text = await file.text();
    const result = parseContactCsv(text);
    setFileName(file.name);
    setPreview(result.contacts);
    setRejected(result.rejected);
    setNotice(
      result.contacts.length
        ? `${result.contacts.length} valid contacts are ready to import.`
        : "No valid email rows were found. Use the example CSV as a template.",
    );
  }

  async function commitImport() {
    if (!preview.length) return;
    if (!importListId && !importListName.trim()) {
      setNotice("Choose an existing list or name a new one.");
      return;
    }
    const failure = await importContacts(preview, importListId, importListName.trim());
    setNotice(failure ?? `Imported ${preview.length} contacts into the CRM directory.`);
    if (!failure) {
      setPreview([]);
      setFileName("");
      setImportListId("");
      setImportListName("");
      setRejected(0);
    }
  }

  async function createList(dynamic: boolean) {
    if (!listName.trim()) {
      setNotice("Name the list before saving it.");
      return;
    }
    const matchingIds = filtered.filter((contact) => contact.status === "active").map((contact) => contact.id);
    const failure = await persistList({
      name: listName.trim(),
      description: listDescription.trim(),
      isDynamic: dynamic,
      query: dynamic ? query : "",
      contactIds: dynamic ? [] : matchingIds,
    });
    setNotice(failure ?? (dynamic ? "Dynamic list saved. It follows the current search." : `List saved with ${matchingIds.length} CRM contacts.`));
    if (!failure) {
      setListName("");
      setListDescription("");
    }
  }

  async function markDoNotContactRow(contact: OutreachContact) {
    const failure = await markDoNotContact(contact.id);
    setNotice(failure ?? `${contactName(contact)} is marked do not contact.`);
  }

  async function addManual(form: FormData) {
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      setNotice("Enter a valid email before adding a contact.");
      return;
    }
    if (state.contacts.some((contact) => contact.email.toLowerCase() === email)) {
      setNotice("That email is already in the CRM.");
      return;
    }
    const failure = await addContact({
      firstName: String(form.get("firstName") ?? "").trim(),
      lastName: String(form.get("lastName") ?? "").trim(),
      company: String(form.get("company") ?? "").trim(),
      role: String(form.get("role") ?? "").trim(),
      email,
      region: String(form.get("region") ?? "").trim(),
      tags: [],
      notes: "",
    });
    setNotice(failure ?? "Contact added to the CRM.");
  }

  const dnc = state.contacts.filter((contact) => contact.status === "do_not_contact").length;

  return (
    <PageContainer>
      <PageHeader
        title="Contacts"
        description={ready ? "These contacts are the same CRM directory. Lists and do-not-contact rules stay with the organization." : "Loading the CRM directory…"}
        actions={
          <Button variant="outline" iconLeft={<Download className="size-3.5" />} onClick={downloadExample}>
            CSV example
          </Button>
        }
      />
      <OutreachWorkflowNav active="contacts" />
      {(notice || error) && <Notice>{notice || error}</Notice>}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="card p-4">
          <h2 className="text-[14px] font-semibold">Import contacts</h2>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--color-ink-secondary)" }}>
            CSV up to a few thousand rows. Each row needs a valid email. Excel import arrives with the mailbox setup.
          </p>
          <label
            className="mt-4 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl px-6 text-center"
            style={{ border: "1px dashed var(--color-border)", background: "var(--color-surface-2)" }}
          >
            <span
              className="flex size-10 items-center justify-center rounded-lg"
              style={{ background: "var(--color-surface)", color: "var(--color-viridian-700)", border: "1px solid var(--color-border)" }}
            >
              <Upload className="size-4" />
            </span>
            <span className="mt-3 text-[13px] font-semibold">Choose a CSV file</span>
            <span className="mt-1 text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
              First name, last name, company, role, email, region, tags
            </span>
            <input
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void previewFile(file);
                event.target.value = "";
              }}
            />
          </label>
          {preview.length > 0 && (
            <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold">{fileName}</div>
                  <div className="text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
                    {preview.length} valid · {rejected} rejected
                  </div>
                </div>
                <Badge tone="viridian">Preview ready</Badge>
              </div>
              <div className="max-h-44 overflow-auto rounded-lg" style={{ border: "1px solid var(--color-border)" }}>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr style={{ background: "var(--color-surface-2)", color: "var(--color-ink-tertiary)" }}>
                      <th className="px-3 py-2 text-left font-medium">Contact</th>
                      <th className="px-3 py-2 text-left font-medium">Company</th>
                      <th className="px-3 py-2 text-left font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 25).map((contact) => (
                      <tr key={contact.email} style={{ borderTop: "1px solid var(--color-border)" }}>
                        <td className="px-3 py-2">{contactName({ ...contact, email: contact.email })}</td>
                        <td className="px-3 py-2">{contact.company || "—"}</td>
                        <td className="px-3 py-2">{contact.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Select
                  value={importListId}
                  onChange={(event) => {
                    setImportListId(event.target.value);
                    if (event.target.value) setImportListName("");
                  }}
                >
                  <option value="">Choose existing list</option>
                  {state.lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </Select>
                <Input
                  value={importListName}
                  onChange={(event) => {
                    setImportListName(event.target.value);
                    if (event.target.value) setImportListId("");
                  }}
                  placeholder="Or name a new list"
                />
              </div>
              <Button className="w-full" variant="primary" iconLeft={<Upload className="size-3.5" />} onClick={commitImport}>
                Import to list
              </Button>
            </div>
          )}
        </section>

        <section className="card p-4 space-y-4">
          <div>
            <h2 className="text-[14px] font-semibold">Add a contact</h2>
            <form
              className="mt-3 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                addManual(new FormData(event.currentTarget));
                event.currentTarget.reset();
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                <Field label="First name">
                  <Input name="firstName" placeholder="Maya" />
                </Field>
                <Field label="Last name">
                  <Input name="lastName" placeholder="Iyer" />
                </Field>
              </div>
              <Field label="Email" required>
                <Input name="email" type="email" placeholder="maya@company.com" required />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Company">
                  <Input name="company" placeholder="Northwind Labs" />
                </Field>
                <Field label="Role">
                  <Input name="role" placeholder="Partnerships" />
                </Field>
              </div>
              <Field label="Region">
                <Input name="region" placeholder="Bengaluru" />
              </Field>
              <Button type="submit" variant="primary">
                Add contact
              </Button>
            </form>
          </div>
          <div className="border-t pt-4" style={{ borderColor: "var(--color-border)" }}>
            <h2 className="text-[14px] font-semibold">Create a list</h2>
            <div className="mt-3 space-y-3">
              <Field label="List name">
                <Input value={listName} onChange={(event) => setListName(event.target.value)} placeholder="Partnership leads" />
              </Field>
              <Field label="Description">
                <Textarea value={listDescription} onChange={(event) => setListDescription(event.target.value)} placeholder="Who this audience is for" />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => createList(false)}>
                  List from {filtered.filter((contact) => contact.status === "active").length} results
                </Button>
                <Button variant="outline" onClick={() => createList(true)}>
                  Dynamic from search
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Stat icon={ContactRound} value={state.contacts.length} label="Total contacts" />
        <Stat icon={Layers3} value={state.lists.length} label="Lists" />
        <Stat icon={ShieldBan} value={dnc} label="Do not contact" />
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <h2 className="text-[14px] font-semibold">Directory</h2>
          <div
            className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg px-3"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <Search className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search company, role, region…"
              className="flex-1 bg-transparent text-[13px] outline-none"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <Th>Contact</Th>
                <Th>Company</Th>
                <Th>Role</Th>
                <Th>Region</Th>
                <Th>Status</Th>
                <Th align="right"> </Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact) => (
                <tr key={contact.id} className="hover:bg-[var(--color-surface-hover)]" style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={contactName(contact)} size="md" />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium">{contactName(contact)}</div>
                        <div className="truncate text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
                          {contact.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <Td>{contact.company || "—"}</Td>
                  <Td muted>{contact.role || "—"}</Td>
                  <Td muted>{contact.region || "—"}</Td>
                  <td className="px-4 py-3">
                    <Badge tone={contact.status === "active" ? "viridian" : contact.status === "do_not_contact" ? "solid" : "outline"}>
                      {contact.status.replaceAll("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => void markDoNotContactRow(contact)} disabled={contact.status === "do_not_contact"}>
                      DNC
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                    No contacts match that search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {state.lists.length > 0 && (
        <section className="mt-4 grid gap-3 md:grid-cols-2">
          {state.lists.map((list) => {
            const count = list.isDynamic
              ? state.contacts.filter((contact) => {
                  const needle = list.query.trim().toLowerCase();
                  if (!needle) return contact.status === "active";
                  return [contact.firstName, contact.lastName, contact.company, contact.role, contact.region]
                    .join(" ")
                    .toLowerCase()
                    .includes(needle);
                }).length
              : list.contactIds.length;
            return (
              <div key={list.id} className="card px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{list.name}</div>
                    <div className="truncate text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
                      {list.description || "No description"}
                    </div>
                  </div>
                  <Badge tone={list.isDynamic ? "outline" : "neutral"}>{count} · {list.isDynamic ? "dynamic" : "static"}</Badge>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </PageContainer>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-4 rounded-lg px-3.5 py-2.5 text-[13px]"
      style={{ background: "var(--color-viridian-50)", color: "var(--color-viridian-800, var(--color-viridian-700))", border: "1px solid var(--color-border)" }}
    >
      {children}
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: number; label: string }) {
  return (
    <div className="card px-4 py-4">
      <div
        className="flex size-9 items-center justify-center rounded-lg"
        style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
      >
        <Icon className="size-4" />
      </div>
      <div className="mt-3 text-[22px] font-semibold tracking-tight">{value}</div>
      <p className="text-[12.5px]" style={{ color: "var(--color-ink-secondary)" }}>{label}</p>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-ink-tertiary)", textAlign: align ?? "left" }}>
      {children}
    </th>
  );
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td className="px-4 py-3 text-[13px]" style={{ color: muted ? "var(--color-ink-secondary)" : "var(--color-ink)" }}>
      {children}
    </td>
  );
}
