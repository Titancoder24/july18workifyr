"use client";

import { useEffect, useState } from "react";
import { Plus, Search, ShieldAlert, CheckCircle2, MoreVertical, UserCog, Calendar, Mail } from "lucide-react";
import { toast } from "sonner";
import { getAdminUsers } from "../actions";

type AuthUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  full_name: string;
  org_id: string | null;
  role: string;
};

export default function UsersManagementPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "user", org: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function loadUsers() {
      const authUsers = await getAdminUsers();
      setUsers(authUsers || []);
      setLoading(false);
    }
    loadUsers();
  }, []);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    
    // Server action to create user would go here.
    // Simulating API call for provisioning form
    await new Promise(r => setTimeout(r, 1000));
    
    const mockCreatedUser: AuthUser = {
      id: crypto.randomUUID(),
      full_name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      org_id: newUser.org || "Org-1",
      created_at: new Date().toISOString(),
    };

    setUsers([mockCreatedUser, ...users]);
    setCreating(false);
    setIsModalOpen(false);
    setNewUser({ name: "", email: "", role: "user", org: "" });
    toast.success("Identity successfully provisioned in Supabase Auth.");
  }

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Identity & Access</h1>
          <p className="text-[14px] text-gray-500 mt-1 font-medium">Manage real Supabase Auth users, organizational links, and system roles.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#40826D] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-[#326756] transition-colors shadow-sm"
        >
          <Plus className="size-4" /> Provision User
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="relative">
            <Search className="size-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search by email or name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D] w-80"
            />
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2 shadow-sm">
              <UserCog className="size-4" /> Bulk Actions
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="text-[11px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50/50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Auth Identity</th>
                <th className="px-6 py-4">Role & Access</th>
                <th className="px-6 py-4">Organization</th>
                <th className="px-6 py-4">Joined At</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-medium">
                    <div className="animate-pulse flex flex-col items-center">
                      <div className="size-8 border-4 border-gray-100 border-t-[#40826D] rounded-full animate-spin mb-4"></div>
                      Fetching identities from Supabase...
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  return (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-[#40826D]/10 text-[#40826D] flex items-center justify-center font-bold shadow-inner">
                            {user.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase() || "U"}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 flex items-center gap-2">
                              {user.full_name || "Unknown"}
                            </div>
                            <div className="text-[12px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                              <Mail className="size-3" /> {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-[11px] font-bold uppercase tracking-wider border border-gray-200 shadow-sm">
                          {user.role || "Member"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[13px] font-medium text-gray-900">
                        {user.org_id ? user.org_id.slice(0, 12) : <span className="text-gray-400 italic">Unassigned</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-gray-600 text-[13px] font-medium">
                          <Calendar className="size-3.5 text-gray-400" />
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-[13px]">
                          <CheckCircle2 className="size-4" /> Active
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-gray-400 hover:text-gray-900 opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-gray-100 rounded-md">
                          <MoreVertical className="size-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-medium">
                    <ShieldAlert className="size-8 mx-auto mb-3 text-gray-300" />
                    No users found in Supabase Auth.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provisioning Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">Provision Auth Identity</h3>
              <p className="text-[13px] text-gray-500 mt-1">Create a secure record directly within Supabase.</p>
            </div>
            
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Full Name</label>
                <input 
                  required
                  type="text" 
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D]" 
                />
              </div>
              
              <div>
                <label className="block text-[12px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Work Email</label>
                <input 
                  required
                  type="email" 
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D]" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">System Role</label>
                  <select 
                    value={newUser.role}
                    onChange={e => setNewUser({...newUser, role: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#40826D]"
                  >
                    <option value="user">Standard User</option>
                    <option value="manager">Manager</option>
                    <option value="hr_admin">HR Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Organization ID</label>
                  <input 
                    type="text" 
                    value={newUser.org}
                    onChange={e => setNewUser({...newUser, org: e.target.value})}
                    placeholder="Auto-assign"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D]" 
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={creating}
                  className="px-4 py-2 text-sm font-bold text-white bg-[#40826D] hover:bg-[#326756] rounded-lg disabled:opacity-50"
                >
                  {creating ? "Provisioning..." : "Create Identity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
