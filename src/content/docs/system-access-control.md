---
title: "Access Control & Security"
category: "System Administration"
order: 1
---

Security is paramount in Workfyr OS. We utilize PostgreSQL Row Level Security (RLS) directly via Supabase to ensure data isolation.

## Data Isolation
Your data is strictly partitioned by your Organization ID (`org_id`). It is cryptographically impossible for users from one organization to query the Leads, Invoices, or Employees of another organization.

## User Roles
Users can be assigned roles to control their access level within the application:
- **Member**: Standard access. Can view CRM data and their own HRM records.
- **Manager**: Can view data for all subordinates within their assigned department.
- **HR Admin**: Can view and edit all employee records, process payroll, and view salaries.
- **Super Admin**: Has access to the Admin Telemetry Dashboard to provision new organizations and system-level users.
